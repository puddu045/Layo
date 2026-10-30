import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { computeCanonicalFlightKey, FlightDataSource, FlightStatus } from '@layo/db';
import type {
  AddJourneySegmentRequest,
  CreateJourneyRequest,
  FlightCandidate,
  Journey,
  UpdateJourneyRequest,
} from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { FlightsService } from '../flights/flights.service';
import { computeLayovers } from './layover.util';

@Injectable()
export class JourneysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flightsService: FlightsService,
  ) {}

  async createJourney(userId: string, dto: CreateJourneyRequest): Promise<Journey> {
    const resolvedFlights = [];
    for (const segment of dto.segments) {
      resolvedFlights.push(await this.resolveFlightForSegment(segment));
    }

    const journey = await this.prisma.client.journey.create({
      data: {
        userId,
        title: dto.title,
        isDiscoverable: dto.isDiscoverable,
        segments: {
          create: resolvedFlights.map((flightId, index) => ({ flightId, sequence: index + 1 })),
        },
      },
    });

    await this.ensureAirportRooms(resolvedFlights);

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

  /** Resolves one journey segment to a persisted Flight row's id, creating it if needed. */
  private async resolveFlightForSegment(segment: AddJourneySegmentRequest): Promise<string> {
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

  private async upsertFlightFromCandidate(candidate: FlightCandidate): Promise<string> {
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
    return flight.id;
  }

  private async upsertManualFlight(entry: AddJourneySegmentRequest['manualEntry']): Promise<string> {
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
    return flight.id;
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
      verified: s.flight.dataSource === 'AVIATIONSTACK',
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
