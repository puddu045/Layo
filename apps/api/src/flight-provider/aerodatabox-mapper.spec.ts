import { describe, expect, it } from 'vitest';
import {
  addDaysToIsoDate,
  buildDailyWindows,
  mapAeroDataBoxStatus,
  parseAeroDataBoxFlight,
  type AeroDataBoxAirportFlight,
} from './aerodatabox-mapper';

function flightRecord(overrides: Partial<AeroDataBoxAirportFlight> = {}): AeroDataBoxAirportFlight {
  return {
    number: 'BA123',
    status: 'Expected',
    codeshareStatus: 'IsOperator',
    airline: { name: 'British Airways', iata: 'BA', icao: 'BAW' },
    departure: {
      airport: { iata: 'LHR', icao: 'EGLL', name: 'London Heathrow', municipalityName: 'London', countryCode: 'GB', timeZone: 'Europe/London' },
      scheduledTime: { utc: '2026-06-01T21:00:00Z', local: '2026-06-01T22:00:00+01:00' },
      terminal: '5',
    },
    arrival: {
      airport: { iata: 'DXB', icao: 'OMDB', name: 'Dubai Intl', municipalityName: 'Dubai', countryCode: 'AE', timeZone: 'Asia/Dubai' },
      scheduledTime: { utc: '2026-06-02T04:30:00Z', local: '2026-06-02T08:30:00+04:00' },
      terminal: '1',
    },
    ...overrides,
  };
}

describe('parseAeroDataBoxFlight', () => {
  it('parses a well-formed record into a candidate', () => {
    const parsed = parseAeroDataBoxFlight(flightRecord(), '2026-06-01');
    expect(parsed).toMatchObject({
      providerRef: 'aerodatabox:BA123:2026-06-01',
      flightNumber: 'BA123',
      isCodeshare: false,
      status: 'SCHEDULED',
      airline: { iataCode: 'BA', icaoCode: 'BAW', name: 'British Airways' },
      departure: { iataCode: 'LHR', timezone: 'Europe/London', scheduledUtc: '2026-06-01T21:00:00Z', terminal: '5' },
      arrival: { iataCode: 'DXB', timezone: 'Asia/Dubai', scheduledUtc: '2026-06-02T04:30:00Z', terminal: '1' },
    });
  });

  it('crosses midnight UTC correctly for an overnight flight without shifting the date', () => {
    // Departs 21:00 UTC on the 1st, arrives 04:30 UTC on the 2nd — the response's own UTC
    // instants are trusted as-is, never recomputed from local time + an assumed offset.
    const parsed = parseAeroDataBoxFlight(flightRecord(), '2026-06-01')!;
    expect(parsed.departure.scheduledUtc.slice(0, 10)).toBe('2026-06-01');
    expect(parsed.arrival.scheduledUtc.slice(0, 10)).toBe('2026-06-02');
  });

  it('marks isCodeshare true only for an explicit codeshare status', () => {
    expect(parseAeroDataBoxFlight(flightRecord({ codeshareStatus: 'IsCodeshare' }), '2026-06-01')!.isCodeshare).toBe(true);
    expect(parseAeroDataBoxFlight(flightRecord({ codeshareStatus: 'IsOperator' }), '2026-06-01')!.isCodeshare).toBe(false);
    expect(parseAeroDataBoxFlight(flightRecord({ codeshareStatus: undefined }), '2026-06-01')!.isCodeshare).toBe(false);
  });

  it('drops a record with no arrival leg rather than inventing one', () => {
    expect(parseAeroDataBoxFlight(flightRecord({ arrival: undefined }), '2026-06-01')).toBeUndefined();
  });

  it('drops a record missing a scheduled UTC time rather than inventing one', () => {
    const record = flightRecord();
    record.departure!.scheduledTime = { local: '2026-06-01T22:00:00+01:00' }; // no utc
    expect(parseAeroDataBoxFlight(record, '2026-06-01')).toBeUndefined();
  });

  it('drops a record missing a flight number', () => {
    expect(parseAeroDataBoxFlight(flightRecord({ number: undefined }), '2026-06-01')).toBeUndefined();
  });

  it('strips the space AeroDataBox puts between the airline code and the number', () => {
    // Confirmed against a real search: AeroDataBox returns e.g. "BA 123", but every other flight
    // number in this app (fixtures, Aviationstack, manual entry, and `flightNumberSchema`'s own
    // regex) is the compact "BA123" form — the un-normalized space made journey creation fail
    // with an opaque "Validation failed" once a real candidate reached that schema.
    const parsed = parseAeroDataBoxFlight(flightRecord({ number: 'BA 123' }), '2026-06-01')!;
    expect(parsed.flightNumber).toBe('BA123');
    expect(parsed.providerRef).toBe('aerodatabox:BA123:2026-06-01');
  });
});

describe('mapAeroDataBoxStatus', () => {
  it.each([
    ['Expected', 'SCHEDULED'],
    ['CheckIn', 'SCHEDULED'],
    ['Boarding', 'SCHEDULED'],
    ['GateClosed', 'SCHEDULED'],
    ['EnRoute', 'ACTIVE'],
    ['Departed', 'ACTIVE'],
    ['Approaching', 'ACTIVE'],
    ['Arrived', 'LANDED'],
    ['Delayed', 'DELAYED'],
    ['Diverted', 'DIVERTED'],
    ['Canceled', 'CANCELLED'],
    ['CanceledUncertain', 'CANCELLED'],
    ['Unknown', 'UNKNOWN'],
    ['SomethingAeroDataBoxAddsLater', 'UNKNOWN'],
  ] as const)('maps AeroDataBox status %s to %s', (raw, expected) => {
    expect(mapAeroDataBoxStatus(raw)).toBe(expected);
  });

  it('defaults to UNKNOWN when no status is given', () => {
    expect(mapAeroDataBoxStatus(undefined)).toBe('UNKNOWN');
  });
});

describe('buildDailyWindows', () => {
  it('splits a local calendar date into two 12-hour windows', () => {
    expect(buildDailyWindows('2026-06-01')).toEqual([
      { fromLocal: '2026-06-01T00:00', toLocal: '2026-06-01T12:00' },
      { fromLocal: '2026-06-01T12:00', toLocal: '2026-06-02T00:00' },
    ]);
  });
});

describe('addDaysToIsoDate', () => {
  it('rolls over to the next month', () => {
    expect(addDaysToIsoDate('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('rolls over to the next year', () => {
    expect(addDaysToIsoDate('2026-12-31', 1)).toBe('2027-01-01');
  });
});
