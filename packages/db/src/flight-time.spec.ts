import { describe, expect, it } from 'vitest';
import { computeCanonicalFlightKey, resolveFixtureTimes } from './flight-time';
import type { FlightFixture } from './fixtures';

const overnightFixture: FlightFixture = {
  flightNumber: 'BA123',
  airlineIataCode: 'BA',
  departureAirportIata: 'LHR',
  arrivalAirportIata: 'DXB',
  departureLocalTime: '22:00',
  arrivalLocalTime: '08:30',
  arrivalDayOffset: 1,
};

describe('resolveFixtureTimes', () => {
  it('rolls the arrival to the next local calendar date for an overnight flight', () => {
    const { scheduledDepartureUtc, scheduledArrivalUtc } = resolveFixtureTimes(
      overnightFixture,
      'Europe/London',
      'Asia/Dubai',
      '2026-06-01',
    );

    // 22:00 BST (UTC+1 in June) on 2026-06-01 => 21:00 UTC
    expect(scheduledDepartureUtc.toISOString()).toBe('2026-06-01T21:00:00.000Z');
    // 08:30 Dubai time (UTC+4) on 2026-06-02 => 04:30 UTC
    expect(scheduledArrivalUtc.toISOString()).toBe('2026-06-02T04:30:00.000Z');
    expect(scheduledArrivalUtc.getTime()).toBeGreaterThan(scheduledDepartureUtc.getTime());
  });

  it('handles a same-day (non-overnight) flight correctly across different timezones', () => {
    const fixture: FlightFixture = {
      flightNumber: 'EK567',
      airlineIataCode: 'EK',
      departureAirportIata: 'DXB',
      arrivalAirportIata: 'HYD',
      departureLocalTime: '11:00',
      arrivalLocalTime: '15:40',
      arrivalDayOffset: 0,
    };
    const { scheduledDepartureUtc, scheduledArrivalUtc } = resolveFixtureTimes(
      fixture,
      'Asia/Dubai',
      'Asia/Kolkata',
      '2026-06-02',
    );
    // 11:00 Dubai (UTC+4) => 07:00 UTC
    expect(scheduledDepartureUtc.toISOString()).toBe('2026-06-02T07:00:00.000Z');
    // 15:40 Kolkata (UTC+5:30) => 10:10 UTC
    expect(scheduledArrivalUtc.toISOString()).toBe('2026-06-02T10:10:00.000Z');
  });
});

describe('computeCanonicalFlightKey', () => {
  it('produces the same key for a marketing flight and its codeshare-operating flight', () => {
    const scheduledDepartureUtc = new Date('2026-06-01T21:00:00.000Z');

    const marketedKey = computeCanonicalFlightKey({
      airlineIataCode: 'AA',
      flightNumber: 'AA7890',
      operatingAirlineIataCode: 'BA',
      operatingFlightNumber: 'BA123',
      departureAirportIata: 'LHR',
      arrivalAirportIata: 'DXB',
      scheduledDepartureUtc,
    });

    const operatingKey = computeCanonicalFlightKey({
      airlineIataCode: 'BA',
      flightNumber: 'BA123',
      departureAirportIata: 'LHR',
      arrivalAirportIata: 'DXB',
      scheduledDepartureUtc,
    });

    expect(marketedKey).toBe(operatingKey);
  });

  it('produces different keys for genuinely different flights', () => {
    const scheduledDepartureUtc = new Date('2026-06-01T21:00:00.000Z');
    const keyA = computeCanonicalFlightKey({
      airlineIataCode: 'EK',
      flightNumber: 'EK567',
      departureAirportIata: 'DXB',
      arrivalAirportIata: 'HYD',
      scheduledDepartureUtc,
    });
    const keyB = computeCanonicalFlightKey({
      airlineIataCode: 'EK',
      flightNumber: 'EK569',
      departureAirportIata: 'DXB',
      arrivalAirportIata: 'BOM',
      scheduledDepartureUtc,
    });
    expect(keyA).not.toBe(keyB);
  });
});
