import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { loadApiEnv } from '@layo/config';
import { computeCanonicalFlightKey, FlightDataSource, FlightStatus } from '@layo/db';
import type {
  AddJourneySegmentRequest,
  AdminJourneyListItem,
  CreateJourneyRequest,
  DuplicateJourneyFlag,
  FlightCandidate,
  Journey,
  ListAdminJourneysQuery,
  Match,
  PaginatedResponse,
  UpdateJourneyRequest,
} from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { FlightsService } from '../flights/flights.service';
import { MessagingService } from '../messaging/messaging.service';
import { computeMatches } from '../matching/matching.algorithm';
import { computePresenceWindows, type PresenceSegmentInput } from '../matching/presence.util';
import { computeLayovers } from './layover.util';

/** A persisted `Flight` row's id plus everything `createJourney` needs beyond that: the
 * departure time, to sort segments chronologically, and the rest, to check this journey's
 * flights against an accepted connection's own journeys for `notifyConnectedTravelOverlaps`. */
interface ResolvedFlight {
  id: string;
  flightNumber: string;
  departureAirportIata: string;
  arrivalAirportIata: string;
  scheduledDepartureUtc: Date;
  scheduledArrivalUtc: Date;
}

@Injectable()
export class JourneysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flightsService: FlightsService,
    private readonly messagingService: MessagingService,
  ) {}

  async createJourney(userId: string, dto: CreateJourneyRequest): Promise<Journey> {
    const resolvedFlights = [];
    for (const segment of dto.segments) {
      resolvedFlights.push(await this.resolveFlightForSegment(segment));
    }

    // Same set of flights as a journey this user already has (order doesn't matter — the sort
    // below is what actually decides order) is someone re-adding a trip they already logged,
    // confirmed in production as the direct result of the sequence bug above: before that fix,
    // the same two flights entered in a different order looked like two different journeys and
    // both got created.
    await this.rejectIfDuplicate(userId, resolvedFlights);

    // `sequence` reflects when each flight actually departs, not the order the segments arrived
    // in on the request — a journey built by adding its later leg first (confirmed in production:
    // a connecting flight added before its own first leg) would otherwise keep that mistake
    // permanently, breaking the journey's title (first departure → last arrival) and layover
    // detection, both of which assume `sequence` order is chronological order.
    const sorted = [...resolvedFlights].sort(
      (a, b) => a.scheduledDepartureUtc.getTime() - b.scheduledDepartureUtc.getTime(),
    );

    const journey = await this.prisma.client.journey.create({
      data: {
        userId,
        title: dto.title,
        isDiscoverable: dto.isDiscoverable,
        segments: {
          create: sorted.map((flight, index) => ({ flightId: flight.id, sequence: index + 1 })),
        },
      },
    });

    await this.ensureAirportRooms(resolvedFlights.map((f) => f.id));
    await this.notifyConnectedTravelOverlaps(userId, sorted);

    return this.getJourney(userId, journey.id);
  }

  async listJourneys(userId: string): Promise<Journey[]> {
    const journeys = await this.prisma.client.journey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: journeyInclude,
    });
    return journeys.map(toJourneyDto);
  }

  async getJourney(userId: string, journeyId: string): Promise<Journey> {
    const journey = await this.prisma.client.journey.findUnique({
      where: { id: journeyId },
      include: journeyInclude,
    });
    if (!journey) throw new NotFoundException('Journey not found');
    if (journey.userId !== userId) throw new ForbiddenException('This journey belongs to another traveller');
    return toJourneyDto(journey);
  }

  async updateJourney(userId: string, journeyId: string, dto: UpdateJourneyRequest): Promise<Journey> {
    await this.assertOwnership(userId, journeyId);
    await this.prisma.client.journey.update({
      where: { id: journeyId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.isDiscoverable !== undefined && { isDiscoverable: dto.isDiscoverable }),
      },
    });
    return this.getJourney(userId, journeyId);
  }

  async deleteJourney(userId: string, journeyId: string): Promise<void> {
    await this.assertOwnership(userId, journeyId);
    await this.prisma.client.journey.delete({ where: { id: journeyId } });
  }

  private async assertOwnership(userId: string, journeyId: string) {
    const journey = await this.prisma.client.journey.findUnique({ where: { id: journeyId } });
    if (!journey) throw new NotFoundException('Journey not found');
    if (journey.userId !== userId) throw new ForbiddenException('This journey belongs to another traveller');
  }

  /** Resolves one journey segment to a persisted Flight row, creating it if needed. Returns
   * `scheduledDepartureUtc` alongside the id so `createJourney` can sort every segment into
   * chronological order regardless of what order they were submitted in. */
  private async resolveFlightForSegment(segment: AddJourneySegmentRequest): Promise<ResolvedFlight> {
    if (segment.confirmedFlight) {
      const candidate = await this.flightsService.resolveConfirmedCandidate(
        segment.confirmedFlight.flightNumber,
        segment.confirmedFlight.departureDate,
        segment.confirmedFlight.providerRef,
      );
      return this.upsertFlightFromCandidate(candidate);
    }

    if (segment.manualEntry) {
      return this.upsertManualFlight(segment.manualEntry);
    }

    throw new BadRequestException('Either confirmedFlight or manualEntry must be provided');
  }

  private async upsertFlightFromCandidate(candidate: FlightCandidate): Promise<ResolvedFlight> {
    const scheduledDepartureUtc = new Date(candidate.scheduledDepartureUtc);
    const canonicalKey = computeCanonicalFlightKey({
      airlineIataCode: candidate.airline.iataCode,
      flightNumber: candidate.flightNumber,
      operatingFlightNumber: candidate.operatingFlightNumber,
      departureAirportIata: candidate.departureAirport.iataCode,
      arrivalAirportIata: candidate.arrivalAirport.iataCode,
      scheduledDepartureUtc,
    });

    const flight = await this.prisma.client.flight.upsert({
      where: { canonicalKey },
      create: {
        airlineIataCode: candidate.airline.iataCode,
        flightNumber: candidate.flightNumber,
        operatingFlightNumber: candidate.operatingFlightNumber,
        departureAirportIata: candidate.departureAirport.iataCode,
        arrivalAirportIata: candidate.arrivalAirport.iataCode,
        scheduledDepartureUtc,
        scheduledArrivalUtc: new Date(candidate.scheduledArrivalUtc),
        departureTerminal: candidate.departureTerminal,
        arrivalTerminal: candidate.arrivalTerminal,
        status: toFlightStatus(candidate.status),
        dataSource: toDataSource(candidate.dataSource),
        canonicalKey,
      },
      update: {
        scheduledDepartureUtc,
        scheduledArrivalUtc: new Date(candidate.scheduledArrivalUtc),
        status: toFlightStatus(candidate.status),
      },
    });
    return {
      id: flight.id,
      flightNumber: flight.flightNumber,
      departureAirportIata: flight.departureAirportIata,
      arrivalAirportIata: flight.arrivalAirportIata,
      scheduledDepartureUtc: flight.scheduledDepartureUtc,
      scheduledArrivalUtc: flight.scheduledArrivalUtc,
    };
  }

  private async upsertManualFlight(entry: AddJourneySegmentRequest['manualEntry']): Promise<ResolvedFlight> {
    if (!entry) throw new BadRequestException('manualEntry is required');

    const [departureAirport, arrivalAirport, airline] = await Promise.all([
      this.prisma.client.airport.findUnique({ where: { iataCode: entry.departureAirportIata } }),
      this.prisma.client.airport.findUnique({ where: { iataCode: entry.arrivalAirportIata } }),
      this.prisma.client.airline.findUnique({ where: { iataCode: entry.airlineIataCode } }),
    ]);
    if (!departureAirport) throw new BadRequestException(`Unknown departure airport: ${entry.departureAirportIata}`);
    if (!arrivalAirport) throw new BadRequestException(`Unknown arrival airport: ${entry.arrivalAirportIata}`);
    if (!airline) throw new BadRequestException(`Unknown airline: ${entry.airlineIataCode}`);

    const scheduledDepartureUtc = new Date(entry.scheduledDepartureUtc);
    const canonicalKey = computeCanonicalFlightKey({
      airlineIataCode: entry.airlineIataCode,
      flightNumber: entry.flightNumber,
      departureAirportIata: entry.departureAirportIata,
      arrivalAirportIata: entry.arrivalAirportIata,
      scheduledDepartureUtc,
    });

    const flight = await this.prisma.client.flight.upsert({
      where: { canonicalKey },
      create: {
        airlineIataCode: entry.airlineIataCode,
        flightNumber: entry.flightNumber,
        departureAirportIata: entry.departureAirportIata,
        arrivalAirportIata: entry.arrivalAirportIata,
        scheduledDepartureUtc,
        scheduledArrivalUtc: new Date(entry.scheduledArrivalUtc),
        departureTerminal: entry.departureTerminal,
        arrivalTerminal: entry.arrivalTerminal,
        status: FlightStatus.UNKNOWN,
        dataSource: FlightDataSource.MANUAL,
        canonicalKey,
      },
      update: {},
    });
    return {
      id: flight.id,
      flightNumber: flight.flightNumber,
      departureAirportIata: flight.departureAirportIata,
      arrivalAirportIata: flight.arrivalAirportIata,
      scheduledDepartureUtc: flight.scheduledDepartureUtc,
      scheduledArrivalUtc: flight.scheduledArrivalUtc,
    };
  }

  /** Blocks re-adding a trip the user already has logged — same set of flights as an existing
   * journey of theirs, regardless of order (the sort above is what decides order, not which
   * journey it ends up in). */
  private async rejectIfDuplicate(userId: string, resolvedFlights: ResolvedFlight[]): Promise<void> {
    const flightIds = new Set(resolvedFlights.map((f) => f.id));
    const existingJourneys = await this.prisma.client.journey.findMany({
      where: { userId },
      select: { segments: { select: { flightId: true } } },
    });

    const isDuplicate = existingJourneys.some((journey) => {
      const existingIds = journey.segments.map((s) => s.flightId);
      return existingIds.length === flightIds.size && existingIds.every((id) => flightIds.has(id));
    });
    if (isDuplicate) {
      throw new ConflictException("You've already added this exact journey.");
    }
  }

  /** Tells each of `userId`'s accepted connections, via a system message in their shared chat,
   * when the journey just created overlaps with one of THEIRS — the same flight, or the same
   * departure/layover airport around the same time, using the identical overlap logic Discover
   * runs for strangers (`computeMatches`), just against this one already-connected person
   * instead of a pool of candidates. Deliberately independent of Discover's own "matching
   * enabled" admin toggle and its tunable thresholds — this is "tell my friend we're travelling
   * together again", not stranger discovery, so it always runs, using the same baseline
   * thresholds Discover falls back to with no admin override. */
  private async notifyConnectedTravelOverlaps(userId: string, newFlights: ResolvedFlight[]): Promise<void> {
    const connections = await this.prisma.client.connection.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
    });
    if (connections.length === 0) return;

    const env = loadApiEnv();
    // `MatchingConfig`'s airport-room fields aren't read by `computeMatches`/`computePresenceWindows`
    // — they're only here because the type bundles them for an unrelated feature (airport-room
    // access windows) — included for a complete, accurate `MatchingConfig` rather than faking them.
    const config = {
      departureAirportWindowMinutesBefore: env.DISCOVERY_DEPARTURE_WINDOW_MINUTES_BEFORE,
      departureAirportWindowMinutesAfter: env.DISCOVERY_DEPARTURE_WINDOW_MINUTES_AFTER,
      minAirportOverlapMinutes: env.DISCOVERY_MIN_AIRPORT_OVERLAP_MINUTES,
      airportRoomAccessWindowHoursBefore: env.AIRPORT_ROOM_ACCESS_WINDOW_HOURS_BEFORE,
      airportRoomAccessWindowHoursAfter: env.AIRPORT_ROOM_ACCESS_WINDOW_HOURS_AFTER,
    };
    const newSegments: PresenceSegmentInput[] = newFlights.map((f, index) => ({
      sequence: index + 1,
      flightId: f.id,
      flightNumber: f.flightNumber,
      departureAirportIata: f.departureAirportIata,
      arrivalAirportIata: f.arrivalAirportIata,
      scheduledDepartureUtc: f.scheduledDepartureUtc,
      scheduledArrivalUtc: f.scheduledArrivalUtc,
    }));
    const requesterWindows = computePresenceWindows(newSegments, config);
    const requesterFlightIds = new Set(newFlights.map((f) => f.id));
    const now = new Date();

    // The airport timezones this journey's own legs touch — every airport `computeMatches`
    // could possibly name back (a departure/layover window's airport, or a shared flight's own
    // departure airport) is one of these, so one small upfront query covers every case below
    // instead of a lookup per connection.
    const airportCodes = [...new Set(newFlights.flatMap((f) => [f.departureAirportIata, f.arrivalAirportIata]))];
    const airports = await this.prisma.client.airport.findMany({ where: { iataCode: { in: airportCodes } } });
    const timezoneByIata = new Map(airports.map((a) => [a.iataCode, a.timezone]));

    for (const connection of connections) {
      const friendId = connection.requesterId === userId ? connection.addresseeId : connection.requesterId;

      const friendJourneys = await this.prisma.client.journey.findMany({
        where: { userId: friendId },
        include: { segments: { include: { flight: true }, orderBy: { sequence: 'asc' } } },
      });
      if (friendJourneys.length === 0) continue;

      const friendSegments: PresenceSegmentInput[] = friendJourneys.flatMap((journey) =>
        journey.segments.map((s) => ({
          sequence: s.sequence,
          flightId: s.flightId,
          flightNumber: s.flight.flightNumber,
          departureAirportIata: s.flight.departureAirportIata,
          arrivalAirportIata: s.flight.arrivalAirportIata,
          scheduledDepartureUtc: s.flight.scheduledDepartureUtc,
          scheduledArrivalUtc: s.flight.scheduledArrivalUtc,
        })),
      );

      const matches = computeMatches({
        requesterWindows,
        requesterFlightIds,
        // `profile` is never read by `computeMatches` for the overlap math itself, only carried
        // through onto its output `Match` — which this never returns, so a stub is fine here.
        candidates: [
          {
            userId: friendId,
            profile: { userId: friendId, displayName: '', bio: '', interests: [], languages: [] },
            segments: friendSegments,
            connectionStatus: 'ACCEPTED',
          },
        ],
        config,
        now,
      });

      const match = matches[0];
      if (!match) continue;

      const body = describeTravelOverlap(match, newSegments, timezoneByIata);
      await this.messagingService.createSystemMessage(connection.id, userId, friendId, body);
    }
  }

  // -- Admin: search, airport traffic inputs, duplicate detection -------------------------

  async adminList(query: ListAdminJourneysQuery): Promise<PaginatedResponse<AdminJourneyListItem>> {
    const where = {
      ...(query.airportIata && {
        segments: { some: { flight: { OR: [{ departureAirportIata: query.airportIata }, { arrivalAirportIata: query.airportIata }] } } },
      }),
      ...(query.search && {
        user: {
          OR: [
            { email: { contains: query.search, mode: 'insensitive' as const } },
            { profile: { displayName: { contains: query.search, mode: 'insensitive' as const } } },
          ],
        },
      }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.client.journey.findMany({
        where,
        include: {
          user: { include: { profile: true } },
          segments: {
            orderBy: { sequence: 'asc' },
            include: { flight: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.client.journey.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        userEmail: row.user.email,
        userDisplayName: row.user.profile?.displayName,
        title: row.title ?? undefined,
        isDiscoverable: row.isDiscoverable,
        segmentCount: row.segments.length,
        firstDepartureAirportIata: row.segments[0]?.flight.departureAirportIata,
        lastArrivalAirportIata: row.segments[row.segments.length - 1]?.flight.arrivalAirportIata,
        createdAt: row.createdAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  /** Flags users with more than one journey containing a segment on the exact same `Flight`
   * row — a real data-integrity signal (the same traveller logged the same flight twice),
   * distinct from many *different* users sharing a flight, which is the normal/expected case
   * that makes matching work at all. */
  async adminListDuplicateFlags(): Promise<DuplicateJourneyFlag[]> {
    const segments = await this.prisma.client.journeySegment.findMany({
      include: { journey: { select: { id: true, userId: true } }, flight: { select: { id: true, flightNumber: true } } },
    });

    const byUserAndFlight = new Map<string, { userId: string; userEmail?: string; flightId: string; flightNumber: string; journeyIds: Set<string> }>();
    for (const s of segments) {
      const key = `${s.journey.userId}:${s.flightId}`;
      const entry = byUserAndFlight.get(key) ?? {
        userId: s.journey.userId,
        flightId: s.flightId,
        flightNumber: s.flight.flightNumber,
        journeyIds: new Set<string>(),
      };
      entry.journeyIds.add(s.journey.id);
      byUserAndFlight.set(key, entry);
    }

    const flagged = [...byUserAndFlight.values()].filter((e) => e.journeyIds.size > 1);
    if (flagged.length === 0) return [];

    const userIds = [...new Set(flagged.map((f) => f.userId))];
    const users = await this.prisma.client.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } });
    const emailByUserId = new Map(users.map((u) => [u.id, u.email]));

    return flagged.map((f) => ({
      userId: f.userId,
      userEmail: emailByUserId.get(f.userId) ?? 'unknown',
      flightId: f.flightId,
      flightNumber: f.flightNumber,
      journeyIds: [...f.journeyIds],
    }));
  }

  private async ensureAirportRooms(flightIds: string[]) {
    const flights = await this.prisma.client.flight.findMany({
      where: { id: { in: flightIds } },
      select: { departureAirportIata: true, arrivalAirportIata: true },
    });
    const airportCodes = new Set<string>();
    for (const f of flights) {
      airportCodes.add(f.departureAirportIata);
      airportCodes.add(f.arrivalAirportIata);
    }
    for (const iataCode of airportCodes) {
      await this.prisma.client.airportRoom.upsert({
        where: { airportIata: iataCode },
        create: { airportIata: iataCode, name: `${iataCode} Airport Chat` },
        update: {},
      });
    }
  }
}

const journeyInclude = {
  segments: {
    orderBy: { sequence: 'asc' as const },
    include: {
      flight: { include: { airline: true, departureAirport: true, arrivalAirport: true } },
    },
  },
};

interface AirportRelation {
  iataCode: string;
  icaoCode: string | null;
  name: string;
  city: string;
  country: string;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
}

interface JourneySegmentRelation {
  id: string;
  sequence: number;
  flight: {
    id: string;
    flightNumber: string;
    operatingFlightNumber: string | null;
    scheduledDepartureUtc: Date;
    scheduledArrivalUtc: Date;
    departureTerminal: string | null;
    arrivalTerminal: string | null;
    status: string;
    dataSource: string;
    airline: { iataCode: string; icaoCode: string | null; name: string };
    departureAirport: AirportRelation;
    arrivalAirport: AirportRelation;
  };
}

function toJourneyDto(journey: {
  id: string;
  title: string | null;
  isDiscoverable: boolean;
  createdAt: Date;
  updatedAt: Date;
  segments: JourneySegmentRelation[];
}): Journey {
  const segments = journey.segments.map((s) => ({
    id: s.id,
    sequence: s.sequence,
    flight: {
      id: s.flight.id,
      airline: {
        iataCode: s.flight.airline.iataCode,
        icaoCode: s.flight.airline.icaoCode ?? undefined,
        name: s.flight.airline.name,
      },
      flightNumber: s.flight.flightNumber,
      operatingFlightNumber: s.flight.operatingFlightNumber ?? undefined,
      departureAirport: toAirportDto(s.flight.departureAirport),
      arrivalAirport: toAirportDto(s.flight.arrivalAirport),
      scheduledDepartureUtc: s.flight.scheduledDepartureUtc.toISOString(),
      scheduledArrivalUtc: s.flight.scheduledArrivalUtc.toISOString(),
      departureTerminal: s.flight.departureTerminal ?? undefined,
      arrivalTerminal: s.flight.arrivalTerminal ?? undefined,
      status: s.flight.status as Journey['segments'][number]['flight']['status'],
      dataSource: s.flight.dataSource as Journey['segments'][number]['flight']['dataSource'],
      verified: s.flight.dataSource === 'AVIATIONSTACK' || s.flight.dataSource === 'AERODATABOX',
    },
  }));

  const layovers = computeLayovers(
    segments.map((s, i) => ({
      sequence: i + 1,
      departureAirportIata: s.flight.departureAirport.iataCode,
      arrivalAirportIata: s.flight.arrivalAirport.iataCode,
      scheduledDepartureUtc: new Date(s.flight.scheduledDepartureUtc),
      scheduledArrivalUtc: new Date(s.flight.scheduledArrivalUtc),
    })),
  );

  return {
    id: journey.id,
    title: journey.title ?? undefined,
    isDiscoverable: journey.isDiscoverable,
    segments,
    layovers,
    createdAt: journey.createdAt.toISOString(),
    updatedAt: journey.updatedAt.toISOString(),
  };
}

function toAirportDto(airport: {
  iataCode: string;
  icaoCode: string | null;
  name: string;
  city: string;
  country: string;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
}) {
  return {
    iataCode: airport.iataCode,
    icaoCode: airport.icaoCode ?? undefined,
    name: airport.name,
    city: airport.city,
    country: airport.country,
    timezone: airport.timezone,
    latitude: airport.latitude ?? undefined,
    longitude: airport.longitude ?? undefined,
  };
}

function toFlightStatus(status: string) {
  return (FlightStatus as Record<string, FlightStatus>)[status] ?? FlightStatus.UNKNOWN;
}

function toDataSource(source: string) {
  return (FlightDataSource as Record<string, FlightDataSource>)[source] ?? FlightDataSource.MANUAL;
}

/** The chat message body for a detected overlap with an already-connected traveller. Needs an
 * airport's timezone to say a sensible date (a flight landing just after local midnight
 * shouldn't be described as departing "a day late") — for SAME_FLIGHT that's the shared flight's
 * own departure airport (found by flight number among this journey's own segments, since `Match`
 * doesn't carry it directly); for the airport-overlap categories it's just `match.airportIata`
 * itself, both ends of the overlap being the same airport. */
function describeTravelOverlap(
  match: Match,
  newSegments: PresenceSegmentInput[],
  timezoneByIata: Map<string, string>,
): string {
  const formatLocalDate = (iso: string, iataCode: string | undefined): string => {
    const timezone = (iataCode && timezoneByIata.get(iataCode)) || 'UTC';
    return DateTime.fromISO(iso, { zone: 'utc' }).setZone(timezone).toFormat('ccc d LLL');
  };

  if (match.category === 'SAME_FLIGHT') {
    const sharedSegment = newSegments.find((s) => s.flightNumber === match.flightNumber);
    const when = formatLocalDate(match.overlapStartUtc, sharedSegment?.departureAirportIata);
    return `You're both on ${match.flightNumber} again — ${when}.`;
  }

  const when = formatLocalDate(match.overlapStartUtc, match.airportIata);
  return match.category === 'SAME_LAYOVER_AIRPORT'
    ? `You've both got a layover at ${match.airportIata} together again — ${when}.`
    : `You're both at ${match.airportIata} around the same time again — ${when}.`;
}
