import { Injectable } from '@nestjs/common';
import { findFlightFixture, resolveFixtureTimes } from '@layo/db';
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

    const [departureAirport, arrivalAirport, airline] = await Promise.all([
      this.prisma.client.airport.findUnique({ where: { iataCode: fixture.departureAirportIata } }),
      this.prisma.client.airport.findUnique({ where: { iataCode: fixture.arrivalAirportIata } }),
      this.prisma.client.airline.findUnique({ where: { iataCode: fixture.airlineIataCode } }),
    ]);
    if (!departureAirport || !arrivalAirport || !airline) return [];

    const { scheduledDepartureUtc, scheduledArrivalUtc } = resolveFixtureTimes(
      fixture,
      departureAirport.timezone,
      arrivalAirport.timezone,
      departureDate,
    );

    const candidate: FlightCandidate = {
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

    return [candidate];
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
