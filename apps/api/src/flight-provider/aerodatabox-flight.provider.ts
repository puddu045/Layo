import { Injectable, Logger } from '@nestjs/common';
import { loadApiEnv } from '@layo/config';
import type { Airline, Airport, FlightCandidate } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { FlightProviderUnavailableError } from './aviationstack-flight.provider';
import { AeroDataBoxQuotaService, AeroDataBoxQuotaExceededError } from './aerodatabox-quota.service';
import type { IFlightProvider } from './flight-provider.interface';
import {
  buildDailyWindows,
  parseAeroDataBoxFlight,
  type AeroDataBoxAirportFidsResponse,
  type AeroDataBoxAirportFlight,
  type ParsedCandidate,
  type ParsedLeg,
} from './aerodatabox-mapper';

/**
 * Real scheduled-flight data via AeroDataBox on RapidAPI (Basic/free plan: 400 request units a
 * month, 12-hour max window per airport-schedule call). Implements both the existing
 * flight-number lookup (`lookup`) and the new airport-to-airport schedule search
 * (`searchDepartures`) — see https://doc.aerodatabox.com/rapidapi.html.
 *
 * Every outbound call goes through `AeroDataBoxQuotaService.reserve` first, which throws
 * *before* the request is made if it would exceed the configured monthly budget — this app
 * never auto-upgrades or silently goes over the free plan.
 */
@Injectable()
export class AeroDataBoxFlightProvider implements IFlightProvider {
  private readonly logger = new Logger(AeroDataBoxFlightProvider.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: AeroDataBoxQuotaService,
  ) {}

  async lookup(flightNumber: string, departureDate: string): Promise<FlightCandidate[]> {
    const env = this.requireConfig();
    await this.reserveOrThrow(env.AERODATABOX_UNITS_PER_CALL);

    const url = `${env.AERODATABOX_BASE_URL}/flights/Number/${encodeURIComponent(flightNumber)}/${departureDate}`;
    const raw = await this.request<AeroDataBoxAirportFlight[]>(url, env);

    const parsed = (raw ?? [])
      .map((record) => parseAeroDataBoxFlight(record, departureDate))
      .filter((c): c is ParsedCandidate => c !== undefined);
    return Promise.all(parsed.map((p) => this.toCandidate(p)));
  }

  /** Every scheduled departure from `departureAirportIata` on the given local date, across all
   * destinations — two 12-hour-window calls merged (the free plan's per-request limit), each
   * reserved against the quota separately. If the second window's reservation is refused (quota
   * ran out mid-request), this returns whatever the first window already found rather than
   * failing the whole search — a partial day's results are still useful, and nothing here ever
   * makes up data for the window that couldn't be fetched. */
  async searchDepartures(departureAirportIata: string, date: string): Promise<FlightCandidate[]> {
    const env = this.requireConfig();
    const windows = buildDailyWindows(date);
    const rawFlights: AeroDataBoxAirportFlight[] = [];

    for (const window of windows) {
      try {
        await this.reserveOrThrow(env.AERODATABOX_UNITS_PER_CALL);
      } catch (err) {
        if (err instanceof AeroDataBoxQuotaExceededError) {
          this.logger.warn(`Stopped mid-search: ${err.message}`);
          break;
        }
        throw err;
      }

      const url =
        `${env.AERODATABOX_BASE_URL}/flights/airports/Iata/${encodeURIComponent(departureAirportIata)}` +
        `/${window.fromLocal}/${window.toLocal}` +
        `?direction=Departure&withLeg=true&withCancelled=false&withCargo=false&withPrivate=false`;
      const body = await this.request<AeroDataBoxAirportFidsResponse>(url, env);
      rawFlights.push(...(body?.departures ?? []));
    }

    const parsed = rawFlights
      .map((record) => parseAeroDataBoxFlight(record, date, departureAirportIata))
      .filter((c): c is ParsedCandidate => c !== undefined);
    return Promise.all(parsed.map((p) => this.toCandidate(p)));
  }

  private requireConfig() {
    const env = loadApiEnv();
    if (!env.AERODATABOX_API_KEY) {
      throw new FlightProviderUnavailableError(
        'AERODATABOX_API_KEY is not configured — set FLIGHT_PROVIDER=mock or provide a key.',
      );
    }
    return env;
  }

  private async reserveOrThrow(units: number) {
    try {
      await this.quota.reserve(units);
    } catch (err) {
      if (err instanceof AeroDataBoxQuotaExceededError) {
        throw new FlightProviderUnavailableError(err.message);
      }
      throw err;
    }
  }

  private async request<T>(url: string, env: ReturnType<typeof loadApiEnv>): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': env.AERODATABOX_API_KEY!,
          'X-RapidAPI-Host': env.AERODATABOX_API_HOST,
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      throw new FlightProviderUnavailableError(`AeroDataBox request failed: ${(err as Error).message}`);
    }

    if (response.status === 429) {
      throw new FlightProviderUnavailableError('AeroDataBox rate limit reached — try again shortly.');
    }
    if (response.status === 404) {
      // AeroDataBox returns 404 for "no flight found" on the by-number endpoint — an empty
      // result, not a failure.
      return undefined as T;
    }
    if (!response.ok) {
      throw new FlightProviderUnavailableError(`AeroDataBox returned HTTP ${response.status}`);
    }

    try {
      return (await response.json()) as T;
    } catch (err) {
      throw new FlightProviderUnavailableError(`AeroDataBox returned an unreadable response: ${(err as Error).message}`);
    }
  }

  private async toCandidate(parsed: ParsedCandidate): Promise<FlightCandidate> {
    const [departureAirport, arrivalAirport, airline] = await Promise.all([
      this.ensureAirport(parsed.departure),
      this.ensureAirport(parsed.arrival),
      this.ensureAirline(parsed.airline),
    ]);

    return {
      providerRef: parsed.providerRef,
      airline,
      flightNumber: parsed.flightNumber,
      operatingFlightNumber: undefined,
      departureAirport,
      arrivalAirport,
      scheduledDepartureUtc: new Date(parsed.departure.scheduledUtc).toISOString(),
      scheduledArrivalUtc: new Date(parsed.arrival.scheduledUtc).toISOString(),
      departureTerminal: parsed.departure.terminal,
      arrivalTerminal: parsed.arrival.terminal,
      status: parsed.status,
      dataSource: 'AERODATABOX',
      isCodeshare: parsed.isCodeshare,
    };
  }

  /** Same "create a reference row if we've never seen this airport before" approach as the
   * Aviationstack provider — but AeroDataBox actually gives us a real IANA timezone, so there's
   * no need for its "default to UTC and let an admin fix it later" fallback. */
  private async ensureAirport(leg: ParsedLeg): Promise<Airport> {
    const existing = await this.prisma.client.airport.findUnique({ where: { iataCode: leg.iataCode } });
    if (existing) {
      return {
        iataCode: existing.iataCode,
        icaoCode: existing.icaoCode ?? undefined,
        name: existing.name,
        city: existing.city,
        country: existing.country,
        timezone: existing.timezone,
        latitude: existing.latitude ?? undefined,
        longitude: existing.longitude ?? undefined,
      };
    }
    const created = await this.prisma.client.airport.create({
      data: {
        iataCode: leg.iataCode,
        icaoCode: leg.icaoCode,
        name: leg.name,
        city: leg.city,
        country: leg.country,
        timezone: leg.timezone ?? 'UTC',
        latitude: leg.latitude,
        longitude: leg.longitude,
      },
    });
    this.logger.log(`Auto-created airport reference row for ${leg.iataCode} from AeroDataBox.`);
    return {
      iataCode: created.iataCode,
      icaoCode: created.icaoCode ?? undefined,
      name: created.name,
      city: created.city,
      country: created.country,
      timezone: created.timezone,
      latitude: created.latitude ?? undefined,
      longitude: created.longitude ?? undefined,
    };
  }

  private async ensureAirline(airline: { iataCode?: string; icaoCode?: string; name: string }): Promise<Airline> {
    if (!airline.iataCode) return { iataCode: 'XX', name: airline.name };
    const existing = await this.prisma.client.airline.findUnique({ where: { iataCode: airline.iataCode } });
    if (existing) return { iataCode: existing.iataCode, icaoCode: existing.icaoCode ?? undefined, name: existing.name };
    const created = await this.prisma.client.airline.create({
      data: { iataCode: airline.iataCode, icaoCode: airline.icaoCode, name: airline.name },
    });
    return { iataCode: created.iataCode, icaoCode: created.icaoCode ?? undefined, name: created.name };
  }
}
