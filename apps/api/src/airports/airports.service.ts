import { Injectable, NotFoundException } from '@nestjs/common';
import { BusinessStatus, DealStatus } from '@layo/db';
import type { AirportTraffic } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AirportsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(search?: string) {
    return this.prisma.client.airport.findMany({
      where: search
        ? {
            OR: [
              { iataCode: { equals: search.toUpperCase() } },
              { name: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { iataCode: 'asc' },
      take: 50,
    });
  }

  async getByIata(iataCode: string) {
    const airport = await this.prisma.client.airport.findUnique({
      where: { iataCode: iataCode.toUpperCase() },
    });
    if (!airport) throw new NotFoundException(`Unknown airport code: ${iataCode}`);
    return airport;
  }

  async listAirlines() {
    return this.prisma.client.airline.findMany({ orderBy: { iataCode: 'asc' } });
  }

  /** Per-airport activity for the admin Flights & Journeys view — journey segment volume
   * (departures + arrivals), room participation, and the business/deal footprint. Limited to
   * the top 25 busiest airports by segment count to keep this cheap. */
  async adminTraffic(): Promise<AirportTraffic[]> {
    const now = new Date();
    const [departures, arrivals, roomMemberships, businesses, deals] = await Promise.all([
      this.prisma.client.flight.groupBy({ by: ['departureAirportIata'], _count: { _all: true } }),
      this.prisma.client.flight.groupBy({ by: ['arrivalAirportIata'], _count: { _all: true } }),
      this.prisma.client.airportRoomMembership.groupBy({ by: ['airportIata'], _count: { _all: true } }),
      this.prisma.client.business.groupBy({ by: ['airportIata'], where: { status: BusinessStatus.APPROVED }, _count: { _all: true } }),
      this.prisma.client.deal.groupBy({
        by: ['airportIata'],
        where: { status: DealStatus.APPROVED, validFrom: { lte: now }, validUntil: { gte: now } },
        _count: { _all: true },
      }),
    ]);

    const airportCodes = new Set<string>();
    for (const r of [...departures, ...arrivals, ...roomMemberships, ...businesses, ...deals]) {
      airportCodes.add('departureAirportIata' in r ? r.departureAirportIata : 'arrivalAirportIata' in r ? r.arrivalAirportIata : r.airportIata);
    }

    const depCount = (code: string) => departures.find((r) => r.departureAirportIata === code)?._count._all ?? 0;
    const arrCount = (code: string) => arrivals.find((r) => r.arrivalAirportIata === code)?._count._all ?? 0;

    return [...airportCodes]
      .map((code) => ({
        airportIata: code,
        journeySegmentCount: depCount(code) + arrCount(code),
        roomParticipantCount: roomMemberships.find((r) => r.airportIata === code)?._count._all ?? 0,
        businessCount: businesses.find((r) => r.airportIata === code)?._count._all ?? 0,
        activeDealCount: deals.find((r) => r.airportIata === code)?._count._all ?? 0,
      }))
      .sort((a, b) => b.journeySegmentCount - a.journeySegmentCount)
      .slice(0, 25);
  }
}
