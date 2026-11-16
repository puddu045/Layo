import { Injectable, Logger } from '@nestjs/common';
import { loadApiEnv } from '@layo/config';
import type { Airline, Airport, FlightCandidate } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { FlightProviderUnavailableError } from './aviationstack-flight.provider';
import { AeroDataBoxQuotaService, AeroDataBoxQuotaExceededError } from './aerodatabox-quota.service';
import type { IFlightProvider } from './flight-provider.interface';
import {
  buildDailyWindows,
  isParsedCandidate,
  localDateOf,
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

    // AeroDataBox's by-number endpoint doesn't strictly limit itself to the queried date — for a
    // flight that departs late enough to cross a UTC date boundary, it can return the adjacent
    // day's instance alongside (or instead of) the one actually requested. Confirmed in
    // production: searching "EK36" for 15 Dec returned both the 14 Dec AND 15 Dec instances of
    // this daily flight. Filtering to the departure's own LOCAL calendar date — at the departure
    // airport, not UTC or the viewer's — is what actually answers "what departs on this date".
    const parsed = (raw ?? [])
      .map((record) => parseAeroDataBoxFlight(record, departureDate))
      .filter((c): c is ParsedCandidate => c !== undefined)
      .filter((c) => localDateOf(c.departure.scheduledUtc, c.departure.timezone ?? 'UTC') === departureDate);
    return this.toCandidates(parsed);
  }

  /** Every scheduled departure from `departureAirportIata` on the given local date, across all
   * destinations — two 12-hour-window calls merged (the free plan's per-request limit), each
   * reserved against the quota separately. If the second window's reservation is refused (quota
   * ran out mid-request), this returns whatever the first window already found rather than
   * failing the whole search — a partial day's results are still useful, and nothing here ever
   * makes up data for the window that couldn't be fetched.
   *
   * Deliberately does NOT touch the database — it only fetches and parses, returning a plain
   * `ParsedCandidate[]` (typed `unknown` at the interface boundary, see `IFlightProvider`). There
   * is no AeroDataBox endpoint that takes both a departure and a destination airport, so this
   * whole day's schedule is the only way to answer ANY specific route — but a search only cares
   * about one destination out of what can be dozens, and resolving every single one into real
   * Airport/Airline database rows (as this used to) was wasted work for everything except the
   * handful the caller actually wants. `resolveDeparturesForDestination` below does that part,
   * scoped to just the matching flights, after this result (or a cached copy of it) is filtered. */
  async fetchDepartureSchedule(departureAirportIata: string, date: string): Promise<ParsedCandidate[]> {
    const env = this.requireConfig();
    const windows = buildDailyWindows(date);
    const rawFlights: AeroDataBoxAirportFlight[] = [];

    for (const window of windows) {
      try {
        await this.reserveOrThrow(env.AERODATABOX_UNITS_PER_CALL);
        const url =
          `${env.AERODATABOX_BASE_URL}/flights/airports/Iata/${encodeURIComponent(departureAirportIata)}` +
          `/${window.fromLocal}/${window.toLocal}` +
          `?direction=Departure&withLeg=true&withCancelled=false&withCargo=false&withPrivate=false`;
        const body = await this.request<AeroDataBoxAirportFidsResponse>(url, env);
        rawFlights.push(...(body?.departures ?? []));
      } catch (err) {
        // `reserveOrThrow` re-throws a quota refusal as `FlightProviderUnavailableError` (see its
        // own comment), so this one check also covers the quota-exhausted-mid-search case, not
        // just an HTTP failure — either way, whatever the other window already found is still
        // worth returning rather than discarding the whole search over one failed half-day.
        if (err instanceof FlightProviderUnavailableError) {
          this.logger.warn(`Stopped mid-search for ${departureAirportIata}/${date}: ${err.message}`);
          break;
        }
        throw err;
      }
    }

    return rawFlights
      .map((record) => parseAeroDataBoxFlight(record, date, departureAirportIata))
      .filter((c): c is ParsedCandidate => c !== undefined);
  }

  /** The one step that actually touches the database — scoped to just the flights going to
   * `destinationAirportIata`, which for a busy hub's full-day schedule is typically a handful out
   * of what can be dozens of records overall.
   *
   * `schedule` isn't trusted to actually be a `ParsedCandidate[]` just because that's what this
   * provider itself writes to the cache — it came back out of `FlightScheduleCache`, a column
   * this app's own earlier (pre-this-split) code also wrote to, in the old fully-resolved
   * `FlightCandidate[]` shape. A row written before this change, read back after it deployed,
   * crashed the whole request on a missing `.arrival`. Every entry is validated before use, same
   * as every other "don't trust the wire, don't invent data" check in this provider — an
   * unrecognized entry is just dropped, not treated as a fatal error. */
  async resolveDeparturesForDestination(
    schedule: unknown,
    destinationAirportIata: string,
  ): Promise<FlightCandidate[]> {
    const matching = (Array.isArray(schedule) ? schedule : [])
      .filter(isParsedCandidate)
      .filter((c) => c.arrival.iataCode === destinationAirportIata);
    return this.toCandidates(matching);
  }

  /** Resolves every airport/airline in `parsed` exactly once, not once per candidate — even
   * scoped to one destination, several flights a day can share an airline (or, for a layover
   * hub, the same route). Confirmed in production: before this and `resolveDeparturesForDestination`
   * existed, resolving every flight in a *whole day's* schedule this way (rather than just the
   * matching destination) both crashed the connection pool (too many concurrent queries) and,
   * even serialized, was slow enough to make a search hang. Sequential, not `Promise.all`, to stay
   * well under Supabase's session-pooler connection limit regardless of batch size. */
  private async toCandidates(parsed: ParsedCandidate[]): Promise<FlightCandidate[]> {
    const legsByIata = new Map<string, ParsedLeg>();
    const airlinesByIata = new Map<string, { iataCode?: string; icaoCode?: string; name: string }>();
    for (const p of parsed) {
      legsByIata.set(p.departure.iataCode, p.departure);
      legsByIata.set(p.arrival.iataCode, p.arrival);
      if (p.airline.iataCode) airlinesByIata.set(p.airline.iataCode, p.airline);
    }

    const airportsByIata = new Map<string, Airport>();
    for (const leg of legsByIata.values()) {
      airportsByIata.set(leg.iataCode, await this.ensureAirport(leg));
    }
    const resolvedAirlinesByIata = new Map<string, Airline>();
    for (const airline of airlinesByIata.values()) {
      resolvedAirlinesByIata.set(airline.iataCode!, await this.ensureAirline(airline));
    }

    return parsed.map((p) => ({
      providerRef: p.providerRef,
      airline: p.airline.iataCode
        ? resolvedAirlinesByIata.get(p.airline.iataCode)!
        : { iataCode: 'XX', name: p.airline.name },
      flightNumber: p.flightNumber,
      operatingFlightNumber: undefined,
      departureAirport: airportsByIata.get(p.departure.iataCode)!,
      arrivalAirport: airportsByIata.get(p.arrival.iataCode)!,
      scheduledDepartureUtc: new Date(p.departure.scheduledUtc).toISOString(),
      scheduledArrivalUtc: new Date(p.arrival.scheduledUtc).toISOString(),
      departureTerminal: p.departure.terminal,
      arrivalTerminal: p.arrival.terminal,
      status: p.status,
      dataSource: 'AERODATABOX',
      isCodeshare: p.isCodeshare,
    }));
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

  /** Same "create a reference row if we've never seen this airport before" approach as the
   * Aviationstack provider — but AeroDataBox actually gives us a real IANA timezone, so there's
   * no need for its "default to UTC and let an admin fix it later" fallback.
   *
   * `upsert`, not `findUnique` then `create`: two overlapping searches (e.g. two users searching
   * the same new airport at once) could otherwise both see "doesn't exist yet" and both proceed
   * to `create`, and the second hits Postgres's unique constraint on `iataCode` and throws.
   * `upsert` lets Postgres resolve that race atomically instead. Called at most once per unique
   * airport per search — see `toCandidates`. */
  private async ensureAirport(leg: ParsedLeg): Promise<Airport> {
    const airport = await this.prisma.client.airport.upsert({
      where: { iataCode: leg.iataCode },
      create: {
        iataCode: leg.iataCode,
        icaoCode: leg.icaoCode,
        name: leg.name,
        city: leg.city,
        country: leg.country,
        timezone: leg.timezone ?? 'UTC',
        latitude: leg.latitude,
        longitude: leg.longitude,
      },
      update: {},
    });
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

  /** Same race-safety reasoning as `ensureAirport` above — `upsert`, not `findUnique`/`create`. */
  private async ensureAirline(airline: { iataCode?: string; icaoCode?: string; name: string }): Promise<Airline> {
    if (!airline.iataCode) return { iataCode: 'XX', name: airline.name };
    const created = await this.prisma.client.airline.upsert({
      where: { iataCode: airline.iataCode },
      create: { iataCode: airline.iataCode, icaoCode: airline.icaoCode, name: airline.name },
      update: {},
    });
    return { iataCode: created.iataCode, icaoCode: created.icaoCode ?? undefined, name: created.name };
  }
}
