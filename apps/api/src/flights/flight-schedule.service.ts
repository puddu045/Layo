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
 * same provider response instead of paying for another call. There's no AeroDataBox endpoint
 * that takes both a departure AND a destination airport, so fetching the whole day's schedule is
 * the only way to answer any specific route at all — but the cached/fetched schedule here is a
 * provider-opaque, pre-database-resolution shape (`unknown`); only the destination the caller
 * actually asked about gets resolved into real `FlightCandidate`s, by the provider itself, in
 * `search` below. Cached in Postgres (not Redis, which is explicitly best-effort/non-durable —
 * see `RedisService`) for up to 7 days, matching AeroDataBox's free-plan retention limit.
 */
@Injectable()
export class FlightScheduleService {
  private readonly logger = new Logger(FlightScheduleService.name);

  // Per-process de-duplication: two concurrent searches for the same (airport, date) join the
  // same in-flight provider call instead of both firing it. A single API instance is this app's
  // current deployment shape (see Railway setup), so a process-local map is sufficient — a
  // distributed lock would be the next step if this API ever runs more than one instance.
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    @Inject(FLIGHT_PROVIDER) private readonly provider: IFlightProvider,
    private readonly prisma: PrismaService,
  ) {}

  async search(request: FlightScheduleSearchRequest): Promise<FlightScheduleSearchResponse> {
    let providerFailureReason: string | undefined;
    const schedule = await this.getSchedule(request.departureAirportIata, request.date, (reason) => {
      providerFailureReason = reason;
    });

    if (schedule === undefined || !this.provider.resolveDeparturesForDestination) {
      return this.buildResponse(request, [], providerFailureReason);
    }

    // The only step that touches the database — scoped to just the destination asked for, not
    // the whole day's schedule (see this class's own comment for why that split exists).
    const candidates = await this.provider.resolveDeparturesForDestination(
      schedule,
      request.destinationAirportIata,
      request.date,
    );
    return this.buildResponse(request, candidates, providerFailureReason);
  }

  /** One airport's full raw schedule for one date, across every destination — cached and
   * de-duplicated, never itself resolved against the database (see `search` above). */
  private async getSchedule(
    departureAirportIata: string,
    date: string,
    onProviderFailure?: (reason: string) => void,
  ): Promise<unknown> {
    const cached = await this.readCache(departureAirportIata, date);
    if (cached !== null) return cached;

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
  ): Promise<unknown> {
    if (!this.provider.fetchDepartureSchedule) {
      onProviderFailure?.('The current flight-data provider does not support schedule search.');
      return undefined;
    }

    try {
      const schedule = await this.provider.fetchDepartureSchedule(departureAirportIata, date);
      await this.writeCache(departureAirportIata, date, schedule);
      return schedule;
    } catch (err) {
      if (err instanceof FlightProviderUnavailableError) {
        this.logger.warn(`Flight schedule provider unavailable: ${err.message}`);
        onProviderFailure?.(err.message);
        return undefined;
      }
      throw err;
    }
  }

  private async readCache(departureAirportIata: string, date: string): Promise<unknown> {
    const row = await this.prisma.client.flightScheduleCache.findUnique({
      where: { departureAirportIata_date: { departureAirportIata, date } },
    });
    if (!row || row.expiresAt < new Date()) return null;
    return row.payload;
  }

  private async writeCache(departureAirportIata: string, date: string, schedule: unknown): Promise<void> {
    const env = loadApiEnv();
    const expiresAt = new Date(Date.now() + env.FLIGHT_SCHEDULE_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.client.flightScheduleCache.upsert({
      where: { departureAirportIata_date: { departureAirportIata, date } },
      create: { departureAirportIata, date, payload: schedule as object, expiresAt },
      update: { payload: schedule as object, fetchedAt: new Date(), expiresAt },
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
