import { describe, expect, it } from 'vitest';
import { computePresenceWindows, overlapMinutes, type PresenceSegmentInput } from './presence.util';

const config = { departureAirportWindowMinutesBefore: 180, departureAirportWindowMinutesAfter: 30 };

describe('computePresenceWindows', () => {
  it('treats the first segment of a journey as a DEPARTURE window, not a layover', () => {
    const segments: PresenceSegmentInput[] = [
      {
        sequence: 1,
        departureAirportIata: 'LHR',
        arrivalAirportIata: 'DXB',
        scheduledDepartureUtc: new Date('2026-06-01T21:00:00Z'),
        scheduledArrivalUtc: new Date('2026-06-02T04:30:00Z'),
        flightId: 'flight-1',
        flightNumber: 'BA123',
      },
    ];
    const windows = computePresenceWindows(segments, config);
    expect(windows).toHaveLength(1);
    expect(windows[0]!.type).toBe('DEPARTURE');
    expect(windows[0]!.airportIata).toBe('LHR');
    expect(windows[0]!.start.toISOString()).toBe('2026-06-01T18:00:00.000Z'); // -3h
    expect(windows[0]!.end.toISOString()).toBe('2026-06-01T21:30:00.000Z'); // +30m
  });

  it('treats a connecting departure as a LAYOVER window spanning arrival to next departure', () => {
    const segments: PresenceSegmentInput[] = [
      {
        sequence: 1,
        departureAirportIata: 'LHR',
        arrivalAirportIata: 'DXB',
        scheduledDepartureUtc: new Date('2026-06-01T21:00:00Z'),
        scheduledArrivalUtc: new Date('2026-06-02T04:30:00Z'),
        flightId: 'flight-1',
        flightNumber: 'BA123',
      },
      {
        sequence: 2,
        departureAirportIata: 'DXB',
        arrivalAirportIata: 'HYD',
        scheduledDepartureUtc: new Date('2026-06-02T07:00:00Z'),
        scheduledArrivalUtc: new Date('2026-06-02T10:10:00Z'),
        flightId: 'flight-2',
        flightNumber: 'EK567',
      },
    ];
    const windows = computePresenceWindows(segments, config);
    const dxbWindow = windows.find((w) => w.airportIata === 'DXB')!;
    expect(dxbWindow.type).toBe('LAYOVER');
    expect(dxbWindow.start.toISOString()).toBe('2026-06-02T04:30:00.000Z');
    expect(dxbWindow.end.toISOString()).toBe('2026-06-02T07:00:00.000Z');
  });

  it('sorts out-of-order input segments by sequence before computing windows', () => {
    const segments: PresenceSegmentInput[] = [
      {
        sequence: 2,
        departureAirportIata: 'DXB',
        arrivalAirportIata: 'HYD',
        scheduledDepartureUtc: new Date('2026-06-02T07:00:00Z'),
        scheduledArrivalUtc: new Date('2026-06-02T10:10:00Z'),
        flightId: 'flight-2',
        flightNumber: 'EK567',
      },
      {
        sequence: 1,
        departureAirportIata: 'LHR',
        arrivalAirportIata: 'DXB',
        scheduledDepartureUtc: new Date('2026-06-01T21:00:00Z'),
        scheduledArrivalUtc: new Date('2026-06-02T04:30:00Z'),
        flightId: 'flight-1',
        flightNumber: 'BA123',
      },
    ];
    const windows = computePresenceWindows(segments, config);
    expect(windows.find((w) => w.airportIata === 'DXB')!.type).toBe('LAYOVER');
  });
});

describe('overlapMinutes', () => {
  it('returns 0 for non-overlapping ranges', () => {
    const a = new Date('2026-06-01T00:00:00Z');
    const b = new Date('2026-06-01T01:00:00Z');
    const c = new Date('2026-06-01T02:00:00Z');
    const d = new Date('2026-06-01T03:00:00Z');
    expect(overlapMinutes(a, b, c, d)).toBe(0);
  });

  it('computes partial overlap in minutes', () => {
    const a = new Date('2026-06-01T00:00:00Z');
    const b = new Date('2026-06-01T02:00:00Z');
    const c = new Date('2026-06-01T01:30:00Z');
    const d = new Date('2026-06-01T03:00:00Z');
    expect(overlapMinutes(a, b, c, d)).toBe(30);
  });
});
