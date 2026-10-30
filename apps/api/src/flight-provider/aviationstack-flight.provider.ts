import { Injectable, Logger } from '@nestjs/common';
import { loadApiEnv } from '@layo/config';
import type { Airline, Airport, FlightCandidate, FlightStatus } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import type { IFlightProvider } from './flight-provider.interface';

/** Thrown when the provider could not be reached or returned an error — callers
 * should treat this as recoverable (fall back to manual entry), never a 500. */
export class FlightProviderUnavailableError extends Error {}

// Minimal shape of the fields we use from Aviationstack's `/flights` response.
// See https://aviationstack.com/documentation
interface AviationstackFlightRecord {
  flight_date: string;
  flight_status: string;
  airline: { name: string; iata: string | null; icao: string | null };
  flight: { number: string; iata: string | null; icao: string | null; codeshared: unknown };
  departure: {
    airport: string;
    iata: string;
    icao: string | null;
    terminal: string | null;
    timezone: string | null;
    scheduled: string;
  };
  arrival: {
    airport: string;
    iata: string;
    icao: string | null;
    terminal: string | null;
    timezone: string | null;
    scheduled: string;
  };
}

interface AviationstackResponse {
  data: AviationstackFlightRecord[];
  error?: { code: string; message: string };
}

const STATUS_MAP: Record<string, FlightStatus> = {
  scheduled: 'SCHEDULED',
  active: 'ACTIVE',
  landed: 'LANDED',
  cancelled: 'CANCELLED',
  incident: 'DIVERTED',
  diverted: 'DIVERTED',
};

@Injectable()
export class AviationstackFlightProvider implements IFlightProvider {
  private readonly logger = new Logger(AviationstackFlightProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  async lookup(flightNumber: string, departureDate: string): Promise<FlightCandidate[]> {
    const env = loadApiEnv();
    if (!env.AVIATIONSTACK_API_KEY) {
      throw new FlightProviderUnavailableError(
        'AVIATIONSTACK_API_KEY is not configured — set FLIGHT_PROVIDER=mock or provide a key.',
      );
    }

    const url = new URL(`${env.AVIATIONSTACK_BASE_URL}/flights`);
    url.searchParams.set('access_key', env.AVIATIONSTACK_API_KEY);
    url.searchParams.set('flight_iata', flightNumber);
    url.searchParams.set('flight_date', departureDate);

    let response: Response;
    try {
      response = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    } catch (err) {
      throw new FlightProviderUnavailableError(`Aviationstack request failed: ${(err as Error).message}`);
    }

    if (!response.ok) {
      throw new FlightProviderUnavailableError(`Aviationstack returned HTTP ${response.status}`);
    }

    const body = (await response.json()) as AviationstackResponse;
    if (body.error) {
      throw new FlightProviderUnavailableError(`Aviationstack error: ${body.error.message}`);
    }

    const candidates: FlightCandidate[] = [];
    for (const record of body.data ?? []) {
      try {
        candidates.push(await this.toCandidate(record));
      } catch (err) {
        this.logger.warn(`Skipping malformed Aviationstack record: ${(err as Error).message}`);
      }
    }
    return candidates;
  }

  private async toCandidate(record: AviationstackFlightRecord): Promise<FlightCandidate> {
    if (!record.departure.iata || !record.arrival.iata || !record.flight.iata) {
      throw new Error('Missing required IATA codes in provider response');
    }

    const [departureAirport, arrivalAirport, airline] = await Promise.all([
      this.ensureAirport(record.departure.iata, record.departure.airport, record.departure.timezone),
      this.ensureAirport(record.arrival.iata, record.arrival.airport, record.arrival.timezone),
      this.ensureAirline(record.airline.iata, record.airline.name),
    ]);

    return {
      providerRef: `aviationstack:${record.flight.iata}:${record.flight_date}`,
      airline,
      flightNumber: record.flight.iata,
      operatingFlightNumber: undefined,
      departureAirport,
      arrivalAirport,
      scheduledDepartureUtc: new Date(record.departure.scheduled).toISOString(),
      scheduledArrivalUtc: new Date(record.arrival.scheduled).toISOString(),
      departureTerminal: record.departure.terminal ?? undefined,
      arrivalTerminal: record.arrival.terminal ?? undefined,
      status: STATUS_MAP[record.flight_status] ?? 'UNKNOWN',
      dataSource: 'AVIATIONSTACK',
      isCodeshare: Boolean(record.flight.codeshared),
    };
  }

  /** Aviationstack doesn't always return full airport metadata — fall back to a
   * sensible default (UTC) timezone rather than failing the whole lookup, and
   * let an admin correct it later via the reference-data tables. */
  private async ensureAirport(iataCode: string, name: string, timezone: string | null): Promise<Airport> {
    const existing = await this.prisma.client.airport.findUnique({ where: { iataCode } });
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
        iataCode,
        name,
        city: name,
        country: 'Unknown',
        timezone: timezone ?? 'UTC',
      },
    });
    this.logger.log(`Auto-created airport reference row for ${iataCode} from Aviationstack response.`);
    return {
      iataCode: created.iataCode,
      name: created.name,
      city: created.city,
      country: created.country,
      timezone: created.timezone,
    };
  }

  private async ensureAirline(iataCode: string | null, name: string): Promise<Airline> {
    if (!iataCode) return { iataCode: 'XX', name };
    const existing = await this.prisma.client.airline.findUnique({ where: { iataCode } });
    if (existing) return { iataCode: existing.iataCode, icaoCode: existing.icaoCode ?? undefined, name: existing.name };
    const created = await this.prisma.client.airline.create({ data: { iataCode, name } });
    return { iataCode: created.iataCode, name: created.name };
  }
}
