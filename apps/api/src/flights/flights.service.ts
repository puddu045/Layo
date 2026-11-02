import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { loadApiEnv } from '@layo/config';
import type { FlightCandidate, FlightLookupFailure, FlightLookupRequest, FlightLookupResponse } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { FLIGHT_PROVIDER, type IFlightProvider } from '../flight-provider/flight-provider.interface';
import { FlightProviderUnavailableError } from '../flight-provider/aviationstack-flight.provider';

@Injectable()
export class FlightsService {
  private readonly logger = new Logger(FlightsService.name);

  constructor(
    @Inject(FLIGHT_PROVIDER) private readonly provider: IFlightProvider,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async lookup(request: FlightLookupRequest): Promise<FlightLookupResponse> {
    let providerFailureReason: string | undefined;
    const candidates = await this.lookupCandidates(request.flightNumber, request.departureDate, (reason) => {
      providerFailureReason = reason;
    });

    if (candidates.length === 0) {
      await this.prisma.client.flightLookupFailure.create({
        data: {
          flightNumber: request.flightNumber,
          departureDate: request.departureDate,
          reason: providerFailureReason ?? 'No matching flight schedule found',
        },
      });
    }

    return this.buildResponse(request, candidates);
  }

  async listLookupFailures(limit = 100): Promise<FlightLookupFailure[]> {
    const rows = await this.prisma.client.flightLookupFailure.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
    return rows.map((row) => ({
      id: row.id,
      flightNumber: row.flightNumber,
      departureDate: row.departureDate,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /** Re-queries the provider (through cache) and returns the single candidate the
   * client confirmed, so persisted flight data always comes from the server's own
   * provider call rather than trusting client-echoed schedule data. */
  async resolveConfirmedCandidate(
    flightNumber: string,
    departureDate: string,
    providerRef: string,
  ): Promise<FlightCandidate> {
    const candidates = await this.lookupCandidates(flightNumber, departureDate);
    const match = candidates.find((c) => c.providerRef === providerRef);
    if (!match) {
      throw new NotFoundException(
        'That flight could not be re-confirmed — it may have changed. Please search again.',
      );
    }
    return match;
  }

  private async lookupCandidates(
    flightNumber: string,
    departureDate: string,
    onProviderFailure?: (reason: string) => void,
  ): Promise<FlightCandidate[]> {
    const cacheKey = `flight-lookup:${flightNumber}:${departureDate}`;
    const cached = await this.redis.getJson<FlightCandidate[]>(cacheKey);
    if (cached) return cached;

    try {
      const candidates = await this.provider.lookup(flightNumber, departureDate);
      const env = loadApiEnv();
      await this.redis.setJson(cacheKey, candidates, env.FLIGHT_CACHE_TTL_SECONDS);
      return candidates;
    } catch (err) {
      if (err instanceof FlightProviderUnavailableError) {
        this.logger.warn(`Flight provider unavailable: ${err.message}`);
        onProviderFailure?.(`Provider unavailable: ${err.message}`);
        return [];
      }
      throw err;
    }
  }

  private buildResponse(request: FlightLookupRequest, candidates: FlightCandidate[]): FlightLookupResponse {
    if (candidates.length === 0) {
      return {
        query: request,
        candidates: [],
        verified: false,
        notice:
          'No matching flight schedule was found. You can add this flight manually — it will be ' +
          'clearly marked as unverified.',
      };
    }

    const dataSource = candidates[0]!.dataSource;
    if (dataSource === 'MOCK') {
      return {
        query: request,
        candidates,
        verified: false,
        notice: 'Demo data — these are fictional example flights, not a real schedule.',
      };
    }

    return { query: request, candidates, verified: true };
  }
}
