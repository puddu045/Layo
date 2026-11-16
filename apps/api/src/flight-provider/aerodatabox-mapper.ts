import type { FlightStatus } from '@layo/contracts';

// Minimal shapes of the fields we read from AeroDataBox's RapidAPI responses. See
// https://doc.aerodatabox.com/rapidapi.html ("Airport FIDS" and "Flight by number" endpoints).
// Every field here is optional on the wire even where AeroDataBox's own docs mark it required —
// parsing never assumes a field is present, and a record missing something essential (e.g. no
// arrival airport, no scheduled UTC time) is dropped rather than guessed at.

export interface AeroDataBoxAirportRef {
  icao?: string;
  iata?: string;
  name?: string;
  municipalityName?: string;
  countryCode?: string;
  timeZone?: string;
  location?: { lat?: number; lon?: number };
}

export interface AeroDataBoxScheduledTime {
  utc?: string;
  local?: string;
}

export interface AeroDataBoxMovement {
  airport?: AeroDataBoxAirportRef;
  scheduledTime?: AeroDataBoxScheduledTime;
  terminal?: string;
}

export interface AeroDataBoxAirline {
  name?: string;
  iata?: string;
  icao?: string;
}

/** One item of `AirportFidsContract.departures` (the airport-schedule endpoint). */
export interface AeroDataBoxAirportFlight {
  number?: string;
  status?: string;
  codeshareStatus?: string;
  departure?: AeroDataBoxMovement;
  arrival?: AeroDataBoxMovement;
  airline?: AeroDataBoxAirline;
}

export interface AeroDataBoxAirportFidsResponse {
  departures?: AeroDataBoxAirportFlight[];
  arrivals?: AeroDataBoxAirportFlight[];
}

/** One item returned by the "flight by number" endpoint — same leg shape, departure/arrival
 * are just always meant to be present (still treated as optional here, defensively). */
export type AeroDataBoxFlightContract = AeroDataBoxAirportFlight;

const STATUS_MAP: Record<string, FlightStatus> = {
  Expected: 'SCHEDULED',
  CheckIn: 'SCHEDULED',
  Boarding: 'SCHEDULED',
  GateClosed: 'SCHEDULED',
  Departed: 'ACTIVE',
  EnRoute: 'ACTIVE',
  Approaching: 'ACTIVE',
  Arrived: 'LANDED',
  Delayed: 'DELAYED',
  Diverted: 'DIVERTED',
  Canceled: 'CANCELLED',
  CanceledUncertain: 'CANCELLED',
  Unknown: 'UNKNOWN',
};

export function mapAeroDataBoxStatus(status: string | undefined): FlightStatus {
  if (!status) return 'UNKNOWN';
  return STATUS_MAP[status] ?? 'UNKNOWN';
}

export interface ParsedLeg {
  iataCode: string;
  icaoCode?: string;
  name: string;
  city: string;
  country: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  scheduledUtc: string;
  terminal?: string;
}

export interface ParsedCandidate {
  providerRef: string;
  flightNumber: string;
  isCodeshare: boolean;
  status: FlightStatus;
  airline: { iataCode?: string; icaoCode?: string; name: string };
  departure: ParsedLeg;
  arrival: ParsedLeg;
}

function isParsedLeg(value: unknown): value is ParsedLeg {
  if (typeof value !== 'object' || value === null) return false;
  const leg = value as Partial<ParsedLeg>;
  return typeof leg.iataCode === 'string' && typeof leg.scheduledUtc === 'string';
}

/** Validates a value read back from `FlightScheduleCache` actually looks like a `ParsedCandidate`
 * before trusting it — a row written under a since-changed cache format (this cache has already
 * changed shape once) would otherwise crash whatever reads it instead of just being treated as
 * unusable, the same "never trust unvalidated data" rule everything else in this file follows. */
export function isParsedCandidate(value: unknown): value is ParsedCandidate {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ParsedCandidate>;
  return (
    typeof candidate.providerRef === 'string' &&
    typeof candidate.flightNumber === 'string' &&
    isParsedLeg(candidate.departure) &&
    isParsedLeg(candidate.arrival)
  );
}

// Confirmed against a real response: AeroDataBox writes this as "2026-11-16 06:00Z" — a space,
// not the "T" the ECMAScript Date parser's ISO format actually requires between date and time.
// `Date`'s leniency with this varies by engine, so it's normalized explicitly rather than relied
// on, same reasoning as never trusting an undocumented wire format to parse itself correctly.
function normalizeUtc(utc: string): string {
  return utc.includes('T') ? utc : utc.replace(' ', 'T');
}

/** The calendar date `scheduledUtc` falls on AT the airport itself (`timezone`, its own IANA
 * zone) — e.g. a 20:25 UTC departure from Dubai (UTC+4) is "the next day" there, not whatever
 * date it happens to be in UTC or at the viewer's own location. `'en-CA'` is just a convenient
 * way to get `Intl.DateTimeFormat` to hand back `YYYY-MM-DD` directly, not a locale choice that
 * matters otherwise. */
export function localDateOf(scheduledUtc: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(scheduledUtc));
}

/** `fallbackIataCode` covers the one real gap in AeroDataBox's airport-schedule endpoint: for a
 * `direction=Departure` query, each result's own `departure.airport` is omitted entirely (it's
 * redundant with the airport you already queried by code), so without this every departure would
 * get silently dropped for "missing airport" — confirmed against a real response, not assumed. */
function parseLeg(movement: AeroDataBoxMovement | undefined, fallbackIataCode?: string): ParsedLeg | undefined {
  const airport = movement?.airport;
  const iataCode = airport?.iata ?? fallbackIataCode;
  const scheduledUtc = movement?.scheduledTime?.utc;
  // The IATA code and a UTC scheduled time are the two things this app cannot do without for a
  // leg — anything else missing (city, country, timezone) gets a placeholder below, same as
  // how the existing Aviationstack provider handles sparse airport metadata.
  if (!iataCode || !scheduledUtc) return undefined;

  return {
    iataCode,
    icaoCode: airport?.icao,
    name: airport?.name ?? iataCode,
    city: airport?.municipalityName ?? airport?.name ?? iataCode,
    country: airport?.countryCode ?? 'Unknown',
    timezone: airport?.timeZone,
    latitude: airport?.location?.lat,
    longitude: airport?.location?.lon,
    scheduledUtc: normalizeUtc(scheduledUtc),
    terminal: movement?.terminal,
  };
}

/** Parses one flight record (from either the airport-schedule or by-number endpoint — they
 * share the same leg shape) into a `ParsedCandidate`, or `undefined` if it's missing anything
 * this app actually needs. `requestedDate` only feeds `providerRef`'s determinism (see below);
 * it never substitutes for a missing scheduled time. `knownDepartureAirportIata` is only ever
 * needed for an airport-schedule search — see `parseLeg`'s comment. */
export function parseAeroDataBoxFlight(
  raw: AeroDataBoxAirportFlight,
  requestedDate: string,
  knownDepartureAirportIata?: string,
): ParsedCandidate | undefined {
  if (!raw.number) return undefined;
  const departure = parseLeg(raw.departure, knownDepartureAirportIata);
  const arrival = parseLeg(raw.arrival);
  if (!departure || !arrival) return undefined;

  // AeroDataBox renders this with a space between the airline code and the number (e.g.
  // "BA 123") — every other flight number in this app (fixtures, Aviationstack, manual entry,
  // and `flightNumberSchema`'s own validation) is the compact "BA123" form with no space, so
  // this is normalized once here rather than letting the space reach contracts validation and
  // fail with an opaque "Validation failed" at journey-creation time.
  const flightNumber = raw.number.replace(/\s+/g, '').toUpperCase();

  return {
    // Deterministic from (flight number, requested local date) alone, not tied to which endpoint
    // or search produced this record — so a flight surfaced by an airport-schedule search can
    // later be re-verified by `FlightsService.resolveConfirmedCandidate` via a fresh by-number
    // lookup and still match on `providerRef`, exactly like the mock/Aviationstack providers.
    providerRef: `aerodatabox:${flightNumber}:${requestedDate}`,
    flightNumber,
    // Confirmed against a real response: AeroDataBox spells this "IsCodeshared", not
    // "IsCodeshare".
    isCodeshare: raw.codeshareStatus === 'IsCodeshared',
    status: mapAeroDataBoxStatus(raw.status),
    airline: { iataCode: raw.airline?.iata, icaoCode: raw.airline?.icao, name: raw.airline?.name ?? raw.number },
    departure,
    arrival,
  };
}

/** `fromLocal`/`toLocal` path segments for the airport-schedule endpoint, which accepts at
 * most a 12-hour window per call on the free plan — a full local day is two calls. Format is
 * the bare `YYYY-MM-DDTHH:mm` AeroDataBox expects, local to the airport, no offset. */
export function buildDailyWindows(date: string): Array<{ fromLocal: string; toLocal: string }> {
  const nextDate = addDaysToIsoDate(date, 1);
  return [
    { fromLocal: `${date}T00:00`, toLocal: `${date}T12:00` },
    { fromLocal: `${date}T12:00`, toLocal: `${nextDate}T00:00` },
  ];
}

export function addDaysToIsoDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year!, month! - 1, day! + days));
  return utcDate.toISOString().slice(0, 10);
}
