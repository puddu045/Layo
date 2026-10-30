import { Injectable } from '@nestjs/common';
import { loadApiEnv, type MatchingConfig } from '@layo/config';
import type { DiscoverQuery, Match, PaginatedResponse } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { toPublicProfile } from '../common/mappers/profile.mapper';
import { BlocksService } from '../safety/blocks.service';
import { computeMatches, type CandidateTraveller } from './matching.algorithm';
import { computePresenceWindows, type PresenceSegmentInput, type PresenceWindow } from './presence.util';

@Injectable()
export class MatchingService {
  private readonly config: MatchingConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly blocksService: BlocksService,
  ) {
    const env = loadApiEnv();
    this.config = {
      departureAirportWindowMinutesBefore: env.DISCOVERY_DEPARTURE_WINDOW_MINUTES_BEFORE,
      departureAirportWindowMinutesAfter: env.DISCOVERY_DEPARTURE_WINDOW_MINUTES_AFTER,
      minAirportOverlapMinutes: env.DISCOVERY_MIN_AIRPORT_OVERLAP_MINUTES,
      airportRoomAccessWindowHoursBefore: env.AIRPORT_ROOM_ACCESS_WINDOW_HOURS_BEFORE,
      airportRoomAccessWindowHoursAfter: env.AIRPORT_ROOM_ACCESS_WINDOW_HOURS_AFTER,
    };
  }

  async discover(requesterId: string, query: DiscoverQuery): Promise<PaginatedResponse<Match>> {
    const now = new Date();

    const requesterJourneys = await this.prisma.client.journey.findMany({
      where: {
        userId: requesterId,
        isDiscoverable: true,
        ...(query.journeyId && { id: query.journeyId }),
      },
      include: { segments: { include: { flight: true }, orderBy: { sequence: 'asc' } } },
    });

    const requesterWindows: PresenceWindow[] = [];
    const requesterFlightIds = new Set<string>();
    for (const journey of requesterJourneys) {
      const segments = toPresenceSegments(journey.segments);
      for (const s of segments) requesterFlightIds.add(s.flightId);
      requesterWindows.push(...computePresenceWindows(segments, this.config));
    }

    if (requesterWindows.length === 0 && requesterFlightIds.size === 0) {
      return emptyPage(query);
    }

    const requesterAirportCodes = [...new Set(requesterWindows.map((w) => w.airportIata))];

    const candidateJourneyIds = await this.findCandidateJourneyIds(
      requesterId,
      requesterAirportCodes,
      [...requesterFlightIds],
    );

    if (candidateJourneyIds.length === 0) {
      return emptyPage(query);
    }

    const candidateJourneys = await this.prisma.client.journey.findMany({
      where: { id: { in: candidateJourneyIds } },
      include: {
        segments: { include: { flight: true }, orderBy: { sequence: 'asc' } },
        user: { include: { profile: true } },
      },
    });

    const blockedUserIds = await this.blocksService.getBlockedUserIdSet(requesterId);
    const candidateUserIds = [...new Set(candidateJourneys.map((j) => j.userId))].filter(
      (id) => !blockedUserIds.has(id),
    );
    const connectionStatusByUser = await this.getConnectionStatuses(requesterId, candidateUserIds);

    const candidates: CandidateTraveller[] = [];
    for (const journey of candidateJourneys) {
      if (blockedUserIds.has(journey.userId)) continue;
      if (!journey.user.profile || !journey.user.profile.discoverable) continue;

      candidates.push({
        userId: journey.userId,
        profile: toPublicProfile(journey.user.profile),
        segments: toPresenceSegments(journey.segments),
        connectionStatus: connectionStatusByUser.get(journey.userId) ?? 'NONE',
      });
    }

    let matches = computeMatches({
      requesterWindows,
      requesterFlightIds,
      candidates,
      config: this.config,
      now,
    });

    if (query.category) {
      matches = matches.filter((m) => m.category === query.category);
    }

    matches.sort((a, b) => new Date(a.overlapStartUtc).getTime() - new Date(b.overlapStartUtc).getTime());

    return paginate(matches, query);
  }

  private async findCandidateJourneyIds(
    requesterId: string,
    airportCodes: string[],
    flightIds: string[],
  ): Promise<string[]> {
    const baseWhere = {
      userId: { not: requesterId },
      isDiscoverable: true,
      user: { status: 'ACTIVE' as const, profile: { discoverable: true } },
    };

    const [byFlight, byAirport] = await Promise.all([
      flightIds.length > 0
        ? this.prisma.client.journeySegment.findMany({
            where: { flightId: { in: flightIds }, journey: baseWhere },
            select: { journeyId: true },
          })
        : Promise.resolve([]),
      airportCodes.length > 0
        ? this.prisma.client.journeySegment.findMany({
            where: {
              journey: baseWhere,
              flight: {
                OR: [
                  { departureAirportIata: { in: airportCodes } },
                  { arrivalAirportIata: { in: airportCodes } },
                ],
              },
            },
            select: { journeyId: true },
          })
        : Promise.resolve([]),
    ]);

    return [...new Set([...byFlight, ...byAirport].map((s) => s.journeyId))];
  }


  private async getConnectionStatuses(
    requesterId: string,
    otherUserIds: string[],
  ): Promise<Map<string, Match['connectionStatus']>> {
    if (otherUserIds.length === 0) return new Map();

    const connections = await this.prisma.client.connection.findMany({
      where: {
        OR: [
          { requesterId, addresseeId: { in: otherUserIds } },
          { addresseeId: requesterId, requesterId: { in: otherUserIds } },
        ],
      },
    });

    const result = new Map<string, Match['connectionStatus']>();
    for (const c of connections) {
      const otherUserId = c.requesterId === requesterId ? c.addresseeId : c.requesterId;
      if (c.status === 'ACCEPTED') {
        result.set(otherUserId, 'ACCEPTED');
      } else if (c.status === 'PENDING') {
        result.set(otherUserId, c.requesterId === requesterId ? 'PENDING_SENT' : 'PENDING_RECEIVED');
      }
    }
    return result;
  }
}

function toPresenceSegments(
  segments: Array<{
    sequence: number;
    flightId: string;
    flight: {
      flightNumber: string;
      departureAirportIata: string;
      arrivalAirportIata: string;
      scheduledDepartureUtc: Date;
      scheduledArrivalUtc: Date;
    };
  }>,
): PresenceSegmentInput[] {
  return segments.map((s) => ({
    sequence: s.sequence,
    flightId: s.flightId,
    flightNumber: s.flight.flightNumber,
    departureAirportIata: s.flight.departureAirportIata,
    arrivalAirportIata: s.flight.arrivalAirportIata,
    scheduledDepartureUtc: s.flight.scheduledDepartureUtc,
    scheduledArrivalUtc: s.flight.scheduledArrivalUtc,
  }));
}


function emptyPage(query: DiscoverQuery): PaginatedResponse<Match> {
  return { items: [], page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 };
}

function paginate(matches: Match[], query: DiscoverQuery): PaginatedResponse<Match> {
  const total = matches.length;
  const start = (query.page - 1) * query.pageSize;
  const items = matches.slice(start, start + query.pageSize);
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize) || 0,
  };
}
