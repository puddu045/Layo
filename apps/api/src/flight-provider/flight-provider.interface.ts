import type { FlightCandidate } from '@layo/contracts';

/**
 * Every flight-data source (mock, Aviationstack, future providers) implements
 * this interface, so `FlightsService` never depends on a specific vendor.
 */
export interface IFlightProvider {
  /** Looks up candidate flight instances for a flight number on a given local departure date. */
  lookup(flightNumber: string, departureDate: string): Promise<FlightCandidate[]>;

  /** Fetches one airport's full raw schedule for one local calendar date, across every
   * destination — there's no AeroDataBox (or typical schedule-provider) endpoint that takes both
   * a departure AND a destination airport, so this is the only way to get any specific route at
   * all. The return shape is opaque to `FlightScheduleService`/callers — provider-specific,
   * cheap to cache as-is (no database writes happen here), and only ever handed back to this
   * same provider's `resolveDeparturesForDestination`. Caching the *whole* day's schedule (not
   * one destination's slice of it) is what lets a different destination search for the same
   * airport+date reuse this exact result instead of spending more of the provider's quota.
   * Optional: only providers that can answer an airport-wide schedule query implement this
   * (currently the mock provider and AeroDataBox; Aviationstack's free plan doesn't support this
   * well, so it's left undefined there and the caller falls back to manual entry). */
  fetchDepartureSchedule?(departureAirportIata: string, date: string): Promise<unknown>;

  /** Filters a schedule from `fetchDepartureSchedule` (fresh or read back from cache) down to
   * flights arriving at `destinationAirportIata`, then resolves ONLY that (typically tiny) subset
   * into real `FlightCandidate`s — database work scoped to what the caller actually asked for,
   * not the whole day's schedule. Implemented whenever `fetchDepartureSchedule` is. */
  resolveDeparturesForDestination?(
    schedule: unknown,
    destinationAirportIata: string,
    date: string,
  ): Promise<FlightCandidate[]>;
}

export const FLIGHT_PROVIDER = Symbol('FLIGHT_PROVIDER');
