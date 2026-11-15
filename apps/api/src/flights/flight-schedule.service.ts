import { Inject, Injectable, Logger } from '@nestjs/common';
import { loadApiEnv } from '@layo/config';
import type { FlightCandidate, FlightScheduleSearchRequest, FlightScheduleSearchResponse } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { FLIGHT_PROVIDER, type IFlightProvider } from '../flight-provider/flight-provider.interface';
import { FlightProviderUnavailableError } from '../flight-provider/aviationstack-flight.provider';

/**
 * Airport-to-airport schedule search ("what flies from X to Y on this date"), kept separate
 * from `FlightsService` (flight-number lookup) since the caching strategy is deliberately
 * different: the cache key is `(departureAirportIata, date)` only — never the destination — so
 * that searching the same departure airport/date for a *different* destination reuses the exact
 * same provider response instead of paying for another call. Cached in Postgres (not Redis,
 * which is explicitly best-effort/non-durable — see `RedisService`) for up to 7 days, matching
 * AeroDataBox's free-plan retention limit.
 */
@Injectable()
export class FlightScheduleService {
  private readonly logger = new Logger(FlightScheduleService.name);

  // Per-process de-duplication: two concurrent searches for the same (airport, date) join the
  // same in-flight provider call instead of both firing it. A single API instance is this app's
  // current deployment shape (see Railway setup), so a process-local map is sufficient — a
  // distributed lock would be the next step if this API ever runs more than one instance.
  private readonly inFlight = new Map<string, Promise<FlightCandidate[]>>();

  constructor(
    @Inject(FLIGHT_PROVIDER) private readonly provider: IFlightProvider,
    private readonly prisma: PrismaService,
  ) {}

  async search(request: FlightScheduleSearchRequest): Promise<FlightScheduleSearchResponse> {
    let providerFailureReason: string | undefined;
    const departures = await this.getDepartures(request.departureAirportIata, request.date, (reason) => {
      providerFailureReason = reason;
    });

    const candidates = departures.filter((c) => c.arrivalAirport.iataCode === request.destinationAirportIata);
    return this.buildResponse(request, candidates, providerFailureReason);
  }

  /** All departures from one airport on one date, across every destination — cached and
   * de-duplicated; callers filter by destination themselves (see `search` above). */
  private async getDepartures(
    departureAirportIata: string,
    date: string,
    onProviderFailure?: (reason: string) => void,
  ): Promise<FlightCandidate[]> {
    const cached = await this.readCache(departureAirportIata, date);
    if (cached) return cached;

    const dedupeKey = `${departureAirportIata}:${date}`;
    const existing = this.inFlight.get(dedupeKey);
    if (existing) return existing;

    const promise = this.fetchAndCache(departureAirportIata, date, onProviderFailure).finally(() => {
      this.inFlight.delete(dedupeKey);
    });
    this.inFlight.set(dedupeKey, promise);
    return promise;
  }

  private async fetchAndCache(
    departureAirportIata: string,
    date: string,
    onProviderFailure?: (reason: string) => void,
  ): Promise<FlightCandidate[]> {
    if (!this.provider.searchDepartures) {
      onProviderFailure?.('The current flight-data provider does not support schedule search.');
      return [];
    }

    try {
      const candidates = await this.provider.searchDepartures(departureAirportIata, date);
      await this.writeCache(departureAirportIata, date, candidates);
      return candidates;
    } catch (err) {
      if (err instanceof FlightProviderUnavailableError) {
        this.logger.warn(`Flight schedule provider unavailable: ${err.message}`);
        onProviderFailure?.(err.message);
        return [];
      }
      throw err;
    }
  }

  private async readCache(departureAirportIata: string, date: string): Promise<FlightCandidate[] | null> {
    const row = await this.prisma.client.flightScheduleCache.findUnique({
      where: { departureAirportIata_date: { departureAirportIata, date } },
    });
    if (!row || row.expiresAt < new Date()) return null;
    return row.payload as FlightCandidate[];
  }

  private async writeCache(departureAirportIata: string, date: string, candidates: FlightCandidate[]): Promise<void> {
    const env = loadApiEnv();
    const expiresAt = new Date(Date.now() + env.FLIGHT_SCHEDULE_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.client.flightScheduleCache.upsert({
      where: { departureAirportIata_date: { departureAirportIata, date } },
      create: { departureAirportIata, date, payload: candidates, expiresAt },
      update: { payload: candidates, fetchedAt: new Date(), expiresAt },
    });
  }

  private buildResponse(
    request: FlightScheduleSearchRequest,
    candidates: FlightCandidate[],
    providerFailureReason: string | undefined,
  ): FlightScheduleSearchResponse {
    if (candidates.length === 0) {
      return {
        query: request,
        candidates: [],
        verified: false,
        notice: providerFailureReason
          ? `Flight schedule search is temporarily unavailable (${providerFailureReason}). You can add this flight manually instead.`
          : 'No scheduled flights were found for this route and date. You can add this flight manually — it will be clearly marked as unverified.',
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
