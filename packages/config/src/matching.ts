/**
 * Default matching/discovery configuration. All values can be overridden via
 * environment variables when loaded through `loadApiEnv()` in `env.ts`.
 */
export interface MatchingConfig {
  /** Minutes before scheduled departure that a traveller is considered "present" at the departure airport. */
  departureAirportWindowMinutesBefore: number;
  /** Minutes after scheduled departure that a traveller is still considered present (boarding/taxi buffer). */
  departureAirportWindowMinutesAfter: number;
  /** Minimum overlap, in minutes, required for two travellers' airport presence windows to count as a match. */
  minAirportOverlapMinutes: number;
  /** How many hours before a traveller's scheduled arrival at an airport they can access that airport's group room. */
  airportRoomAccessWindowHoursBefore: number;
  /** How many hours after a traveller's scheduled departure from an airport they keep access to that airport's group room. */
  airportRoomAccessWindowHoursAfter: number;
}

export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  departureAirportWindowMinutesBefore: 180,
  departureAirportWindowMinutesAfter: 30,
  minAirportOverlapMinutes: 30,
  airportRoomAccessWindowHoursBefore: 6,
  airportRoomAccessWindowHoursAfter: 4,
};
