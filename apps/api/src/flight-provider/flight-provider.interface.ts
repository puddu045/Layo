import type { FlightCandidate } from '@layo/contracts';

/**
 * Every flight-data source (mock, Aviationstack, future providers) implements
 * this interface, so `FlightsService` never depends on a specific vendor.
 */
export interface IFlightProvider {
  /** Looks up candidate flight instances for a flight number on a given local departure date. */
  lookup(flightNumber: string, departureDate: string): Promise<FlightCandidate[]>;
}

export const FLIGHT_PROVIDER = Symbol('FLIGHT_PROVIDER');
