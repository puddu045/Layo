import type { FlightCandidate } from '@layo/contracts';

/**
 * Every flight-data source (mock, Aviationstack, future providers) implements
 * this interface, so `FlightsService` never depends on a specific vendor.
 */
export interface IFlightProvider {
  /** Looks up candidate flight instances for a flight number on a given local departure date. */
  lookup(flightNumber: string, departureDate: string): Promise<FlightCandidate[]>;

  /** Every scheduled departure from one airport on one local calendar date, across all
   * destinations — `FlightScheduleService` filters the result down to one destination itself,
   * so the same call can be cached and reused across different destination searches. Optional:
   * only providers that can actually answer an airport-wide schedule query implement it
   * (currently the mock provider and AeroDataBox; Aviationstack's free plan doesn't support
   * this well, so it's left undefined there and the caller falls back to manual entry). */
  searchDepartures?(departureAirportIata: string, date: string): Promise<FlightCandidate[]>;
}

export const FLIGHT_PROVIDER = Symbol('FLIGHT_PROVIDER');
