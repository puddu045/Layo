import { describe, expect, it } from 'vitest';
import { computeLayovers, type SegmentTimingInput } from './layover.util';

describe('computeLayovers', () => {
  it('computes a single layover between two connecting segments', () => {
    const segments: SegmentTimingInput[] = [
      {
        sequence: 1,
        departureAirportIata: 'LHR',
        arrivalAirportIata: 'DXB',
        scheduledDepartureUtc: new Date('2026-06-01T21:00:00Z'),
        scheduledArrivalUtc: new Date('2026-06-02T04:30:00Z'),
      },
      {
        sequence: 2,
        departureAirportIata: 'DXB',
        arrivalAirportIata: 'HYD',
        scheduledDepartureUtc: new Date('2026-06-02T07:00:00Z'),
        scheduledArrivalUtc: new Date('2026-06-02T10:10:00Z'),
      },
    ];

    const layovers = computeLayovers(segments);
    expect(layovers).toHaveLength(1);
    expect(layovers[0]).toMatchObject({
      airportIata: 'DXB',
      durationMinutes: 150, // 04:30 -> 07:00
    });
  });

  it('does not report a layover when consecutive segments are not a real connection', () => {
    const segments: SegmentTimingInput[] = [
      {
        sequence: 1,
        departureAirportIata: 'LHR',
        arrivalAirportIata: 'SIN',
        scheduledDepartureUtc: new Date('2026-06-01T23:00:00Z'),
        scheduledArrivalUtc: new Date('2026-06-02T19:30:00Z'),
      },
      {
        sequence: 2,
        // A later, unrelated trip departing from a different airport than SIN.
        departureAirportIata: 'DXB',
        arrivalAirportIata: 'SIN',
        scheduledDepartureUtc: new Date('2026-07-01T10:30:00Z'),
        scheduledArrivalUtc: new Date('2026-07-01T22:00:00Z'),
      },
    ];

    expect(computeLayovers(segments)).toHaveLength(0);
  });

  it('handles a three-segment journey with two layovers', () => {
    const segments: SegmentTimingInput[] = [
      {
        sequence: 1,
        departureAirportIata: 'NCL',
        arrivalAirportIata: 'AMS',
        scheduledDepartureUtc: new Date('2026-06-01T05:00:00Z'),
        scheduledArrivalUtc: new Date('2026-06-01T07:30:00Z'),
      },
      {
        sequence: 2,
        departureAirportIata: 'AMS',
        arrivalAirportIata: 'DXB',
        scheduledDepartureUtc: new Date('2026-06-01T09:00:00Z'),
        scheduledArrivalUtc: new Date('2026-06-01T14:30:00Z'),
      },
      {
        sequence: 3,
        departureAirportIata: 'DXB',
        arrivalAirportIata: 'SIN',
        scheduledDepartureUtc: new Date('2026-06-01T16:00:00Z'),
        scheduledArrivalUtc: new Date('2026-06-01T22:00:00Z'),
      },
    ];

    const layovers = computeLayovers(segments);
    expect(layovers).toHaveLength(2);
    expect(layovers[0]!.airportIata).toBe('AMS');
    expect(layovers[1]!.airportIata).toBe('DXB');
  });
});
