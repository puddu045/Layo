import { DateTime } from 'luxon';
import type { FlightFixture } from './fixtures';

/**
 * Converts a fixture's local departure/arrival clock times — on a given local
 * departure date — into UTC instants, using each airport's IANA timezone.
 * This is what correctly handles overnight flights and international date
 * changes: we never do arithmetic on raw clock strings, only on zoned
 * `DateTime`s.
 */
export function resolveFixtureTimes(
  fixture: FlightFixture,
  departureAirportTimezone: string,
  arrivalAirportTimezone: string,
  localDepartureDate: string, // YYYY-MM-DD, local to the departure airport
): { scheduledDepartureUtc: Date; scheduledArrivalUtc: Date } {
  const [depHour, depMinute] = fixture.departureLocalTime.split(':').map(Number);
  const [arrHour, arrMinute] = fixture.arrivalLocalTime.split(':').map(Number);

  const departure = DateTime.fromISO(localDepartureDate, { zone: departureAirportTimezone }).set({
    hour: depHour,
    minute: depMinute,
    second: 0,
    millisecond: 0,
  });

  if (!departure.isValid) {
    throw new Error(`Invalid departure date/timezone: ${localDepartureDate} / ${departureAirportTimezone}`);
  }

  // The arrival local calendar date is the flight's own requested departure date
  // plus the fixture's day offset, interpreted directly in the ARRIVAL airport's
  // timezone — not derived from the departure instant's zoned date, which would
  // already reflect the UTC-offset difference between the two airports and
  // double-count it against `arrivalDayOffset`.
  const arrival = DateTime.fromISO(localDepartureDate, { zone: arrivalAirportTimezone })
    .plus({ days: fixture.arrivalDayOffset })
    .set({
      hour: arrHour,
      minute: arrMinute,
      second: 0,
      millisecond: 0,
    });

  return {
    scheduledDepartureUtc: departure.toJSDate(),
    scheduledArrivalUtc: arrival.toJSDate(),
  };
}

/**
 * Canonical key used to de-duplicate flight instances. Codeshares resolve to the
 * SAME key as the operating flight, which is what makes "same flight" matching
 * treat a codeshare-marketed ticket as equivalent to the operating flight.
 */
export function computeCanonicalFlightKey(params: {
  airlineIataCode: string;
  flightNumber: string;
  operatingAirlineIataCode?: string;
  operatingFlightNumber?: string;
  departureAirportIata: string;
  arrivalAirportIata: string;
  scheduledDepartureUtc: Date;
}): string {
  const effectiveAirline = params.operatingAirlineIataCode ?? params.airlineIataCode;
  const effectiveFlightNumber = params.operatingFlightNumber ?? params.flightNumber;
  const utcDate = params.scheduledDepartureUtc.toISOString().slice(0, 10);
  return [
    effectiveAirline,
    effectiveFlightNumber,
    params.departureAirportIata,
    params.arrivalAirportIata,
    utcDate,
  ].join('-');
}
