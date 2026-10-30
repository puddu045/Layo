import { Injectable, NotFoundException } from '@nestjs/common';
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
}
