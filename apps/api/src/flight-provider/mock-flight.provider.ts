import { Injectable } from '@nestjs/common';
import { findFlightFixture, findFlightFixturesByDeparture, resolveFixtureTimes, type FlightFixture } from '@layo/db';
import type { Airline, Airport, FlightCandidate } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import type { IFlightProvider } from './flight-provider.interface';

/**
 * Deterministic, offline flight provider backed by `@layo/db`'s fixture data.
 * Used by default so the whole app runs without any paid API key.
 *
 * Every flight number it knows about is clearly fictional demo data — see
 * `packages/db/src/fixtures.ts` for the full list.
 */
@Injectable()
export class MockFlightProvider implements IFlightProvider {
  constructor(private readonly prisma: PrismaService) {}

  async lookup(flightNumber: string, departureDate: string): Promise<FlightCandidate[]> {
    const fixture = findFlightFixture(flightNumber);
    if (!fixture) return [];
    const candidate = await this.buildCandidate(fixture, departureDate);
    return candidate ? [candidate] : [];
  }

  /** Offline stand-in for an airport-to-airport schedule search: every fixture flight departing
   * this airport, regardless of destination. The fixture set is tiny (a handful of flights total),
   * so unlike the real AeroDataBox provider there's no cost to resolving everything eagerly here —
   * the "schedule" this returns already is the resolved `FlightCandidate[]`. */
  async fetchDepartureSchedule(departureAirportIata: string, date: string): Promise<FlightCandidate[]> {
    const fixtures = findFlightFixturesByDeparture(departureAirportIata);
    const candidates = await Promise.all(fixtures.map((fixture) => this.buildCandidate(fixture, date)));
    return candidates.filter((c): c is FlightCandidate => c !== undefined);
  }

  async resolveDeparturesForDestination(schedule: unknown, destinationAirportIata: string): Promise<FlightCandidate[]> {
    return (schedule as FlightCandidate[]).filter((c) => c.arrivalAirport.iataCode === destinationAirportIata);
  }

  private async buildCandidate(fixture: FlightFixture, departureDate: string): Promise<FlightCandidate | undefined> {
    const [departureAirport, arrivalAirport, airline] = await Promise.all([
      this.prisma.client.airport.findUnique({ where: { iataCode: fixture.departureAirportIata } }),
      this.prisma.client.airport.findUnique({ where: { iataCode: fixture.arrivalAirportIata } }),
      this.prisma.client.airline.findUnique({ where: { iataCode: fixture.airlineIataCode } }),
    ]);
    if (!departureAirport || !arrivalAirport || !airline) return undefined;

    const { scheduledDepartureUtc, scheduledArrivalUtc } = resolveFixtureTimes(
      fixture,
      departureAirport.timezone,
      arrivalAirport.timezone,
      departureDate,
    );

    return {
      providerRef: `mock:${fixture.flightNumber}:${departureDate}`,
      airline: toAirlineDto(airline),
      flightNumber: fixture.flightNumber,
      operatingFlightNumber: fixture.operatingFlightNumber,
      departureAirport: toAirportDto(departureAirport),
      arrivalAirport: toAirportDto(arrivalAirport),
      scheduledDepartureUtc: scheduledDepartureUtc.toISOString(),
      scheduledArrivalUtc: scheduledArrivalUtc.toISOString(),
      departureTerminal: fixture.departureTerminal,
      arrivalTerminal: fixture.arrivalTerminal,
      status: 'SCHEDULED',
      dataSource: 'MOCK',
      isCodeshare: Boolean(fixture.operatingFlightNumber),
    };
  }
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
}): Airport {
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

function toAirlineDto(airline: { iataCode: string; icaoCode: string | null; name: string }): Airline {
  return { iataCode: airline.iataCode, icaoCode: airline.icaoCode ?? undefined, name: airline.name };
}
