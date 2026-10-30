import { describe, expect, it } from 'vitest';
import type { MatchingConfig } from '@layo/config';
import type { PublicProfile } from '@layo/contracts';
import { computeMatches, type CandidateTraveller } from './matching.algorithm';
import { computePresenceWindows, type PresenceSegmentInput } from './presence.util';

const config: MatchingConfig = {
  departureAirportWindowMinutesBefore: 180,
  departureAirportWindowMinutesAfter: 30,
  minAirportOverlapMinutes: 30,
  airportRoomAccessWindowHoursBefore: 6,
  airportRoomAccessWindowHoursAfter: 4,
};

const NOW = new Date('2026-05-01T00:00:00Z'); // well before every fixture's departure

function profile(userId: string, displayName: string): PublicProfile {
  return { userId, displayName, bio: '', interests: [], languages: [] };
}

function segment(
  overrides: Partial<PresenceSegmentInput> & Pick<PresenceSegmentInput, 'flightId' | 'flightNumber'>,
): PresenceSegmentInput {
  return {
    sequence: 1,
    departureAirportIata: 'LHR',
    arrivalAirportIata: 'DXB',
    scheduledDepartureUtc: new Date('2026-06-01T21:00:00Z'),
    scheduledArrivalUtc: new Date('2026-06-02T04:30:00Z'),
    ...overrides,
  };
}

describe('computeMatches', () => {
  it('matches two travellers on the exact same canonical flight, including when it is marketed as a codeshare', () => {
    // Amara (requester) is booked as BA123; Noah is booked on the codeshare AA7890 —
    // in the database both resolve to the SAME canonical Flight row/id.
    const amaraFlight = segment({ flightId: 'flight-ba123', flightNumber: 'BA123' });
    const requesterWindows = computePresenceWindows([amaraFlight], config);

    const noah: CandidateTraveller = {
      userId: 'noah',
      profile: profile('noah', 'Noah Lindqvist'),
      segments: [segment({ flightId: 'flight-ba123', flightNumber: 'AA7890' })],
      connectionStatus: 'NONE',
    };

    const matches = computeMatches({
      requesterWindows,
      requesterFlightIds: new Set(['flight-ba123']),
      candidates: [noah],
      config,
      now: NOW,
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      category: 'SAME_FLIGHT',
      flightNumber: 'AA7890', // shown using the candidate's OWN booking reference
      profile: { userId: 'noah' },
    });
  });

  it('matches two travellers departing the same origin airport around the same time on different flights', () => {
    const amaraFlight = segment({ flightId: 'flight-ba123', flightNumber: 'BA123' });
    const requesterWindows = computePresenceWindows([amaraFlight], config);

    const daniel: CandidateTraveller = {
      userId: 'daniel',
      profile: profile('daniel', 'Daniel Cole'),
      segments: [
        segment({
          flightId: 'flight-ba789',
          flightNumber: 'BA789',
          scheduledDepartureUtc: new Date('2026-06-01T23:00:00Z'),
          scheduledArrivalUtc: new Date('2026-06-02T19:30:00Z'),
          arrivalAirportIata: 'SIN',
        }),
      ],
      connectionStatus: 'NONE',
    };

    const matches = computeMatches({
      requesterWindows,
      requesterFlightIds: new Set(['flight-ba123']),
      candidates: [daniel],
      config,
      now: NOW,
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]!.category).toBe('SAME_DEPARTURE_AIRPORT');
    expect(matches[0]!.airportIata).toBe('LHR');
  });

  it('matches two travellers with an overlapping layover, even though they fly to different final destinations', () => {
    const requesterSegments: PresenceSegmentInput[] = [
      segment({ flightId: 'flight-ba123', flightNumber: 'BA123' }),
      segment({
        sequence: 2,
        flightId: 'flight-ek567',
        flightNumber: 'EK567',
        departureAirportIata: 'DXB',
        arrivalAirportIata: 'HYD',
        scheduledDepartureUtc: new Date('2026-06-02T07:00:00Z'),
        scheduledArrivalUtc: new Date('2026-06-02T10:10:00Z'),
      }),
    ];
    const requesterWindows = computePresenceWindows(requesterSegments, config);

    // Zara departs DXB directly (it's her trip ORIGIN, not a layover) but her window
    // still overlaps the requester's DXB layover window.
    const zara: CandidateTraveller = {
      userId: 'zara',
      profile: profile('zara', 'Zara Hassan'),
      segments: [
        segment({
          flightId: 'flight-ek303',
          flightNumber: 'EK303',
          departureAirportIata: 'DXB',
          arrivalAirportIata: 'SIN',
          scheduledDepartureUtc: new Date('2026-06-02T06:30:00Z'),
          scheduledArrivalUtc: new Date('2026-06-02T18:00:00Z'),
        }),
      ],
      connectionStatus: 'NONE',
    };

    const matches = computeMatches({
      requesterWindows,
      requesterFlightIds: new Set(['flight-ba123', 'flight-ek567']),
      candidates: [zara],
      config,
      now: NOW,
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]!.category).toBe('SAME_LAYOVER_AIRPORT');
    expect(matches[0]!.airportIata).toBe('DXB');
    expect(matches[0]!.overlapMinutes).toBeGreaterThanOrEqual(config.minAirportOverlapMinutes);
  });

  it('suppresses a redundant departure/layover match for someone already matched via SAME_FLIGHT', () => {
    const requesterSegments: PresenceSegmentInput[] = [
      segment({ flightId: 'flight-ba123', flightNumber: 'BA123' }),
      segment({
        sequence: 2,
        flightId: 'flight-ek567',
        flightNumber: 'EK567',
        departureAirportIata: 'DXB',
        arrivalAirportIata: 'HYD',
        scheduledDepartureUtc: new Date('2026-06-02T07:00:00Z'),
        scheduledArrivalUtc: new Date('2026-06-02T10:10:00Z'),
      }),
    ];
    const requesterWindows = computePresenceWindows(requesterSegments, config);

    // Vikram shares the BA123 leg with the requester AND has an overlapping DXB layover —
    // only the more specific SAME_FLIGHT match should be reported for him.
    const vikram: CandidateTraveller = {
      userId: 'vikram',
      profile: profile('vikram', 'Vikram Shah'),
      segments: [
        segment({ flightId: 'flight-ba123', flightNumber: 'BA123' }),
        segment({
          sequence: 2,
          flightId: 'flight-ek569',
          flightNumber: 'EK569',
          departureAirportIata: 'DXB',
          arrivalAirportIata: 'BOM',
          scheduledDepartureUtc: new Date('2026-06-02T07:30:00Z'),
          scheduledArrivalUtc: new Date('2026-06-02T11:00:00Z'),
        }),
      ],
      connectionStatus: 'NONE',
    };

    const matches = computeMatches({
      requesterWindows,
      requesterFlightIds: new Set(['flight-ba123', 'flight-ek567']),
      candidates: [vikram],
      config,
      now: NOW,
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]!.category).toBe('SAME_FLIGHT');
  });

  it('does not report a match when airport overlap is below the configured minimum', () => {
    const requesterWindows = computePresenceWindows(
      [segment({ flightId: 'flight-ba123', flightNumber: 'BA123' })],
      config,
    );

    const candidate: CandidateTraveller = {
      userId: 'barely-overlapping',
      profile: profile('barely-overlapping', 'Barely Overlapping'),
      segments: [
        segment({
          flightId: 'flight-other',
          flightNumber: 'XX999',
          // Requester's LHR window is [18:00, 21:30] on 06-01. This flight's own
          // window is [21:20 06-01, 00:50 06-02], overlapping by only 10 minutes —
          // below the configured 30-minute floor.
          scheduledDepartureUtc: new Date('2026-06-02T00:20:00Z'),
          scheduledArrivalUtc: new Date('2026-06-02T10:00:00Z'),
        }),
      ],
      connectionStatus: 'NONE',
    };

    const matches = computeMatches({
      requesterWindows,
      requesterFlightIds: new Set(['flight-ba123']),
      candidates: [candidate],
      config,
      now: NOW,
    });

    expect(matches).toHaveLength(0);
  });

  it('excludes matches whose overlap window has already fully passed', () => {
    const requesterWindows = computePresenceWindows(
      [segment({ flightId: 'flight-ba123', flightNumber: 'BA123' })],
      config,
    );

    const candidate: CandidateTraveller = {
      userId: 'past-traveller',
      profile: profile('past-traveller', 'Past Traveller'),
      segments: [segment({ flightId: 'flight-ba123', flightNumber: 'BA123' })],
      connectionStatus: 'NONE',
    };

    const matches = computeMatches({
      requesterWindows,
      requesterFlightIds: new Set(['flight-ba123']),
      candidates: [candidate],
      config,
      // "now" is after the flight has already landed.
      now: new Date('2026-06-03T00:00:00Z'),
    });

    expect(matches).toHaveLength(0);
  });

  it('always flags meeting accessibility as unconfirmed (no inter-terminal connectivity data exists)', () => {
    const requesterWindows = computePresenceWindows(
      [segment({ flightId: 'flight-ba123', flightNumber: 'BA123' })],
      config,
    );
    const candidate: CandidateTraveller = {
      userId: 'noah',
      profile: profile('noah', 'Noah Lindqvist'),
      segments: [segment({ flightId: 'flight-ba123', flightNumber: 'BA123' })],
      connectionStatus: 'NONE',
    };

    const matches = computeMatches({
      requesterWindows,
      requesterFlightIds: new Set(['flight-ba123']),
      candidates: [candidate],
      config,
      now: NOW,
    });

    expect(matches[0]!.meetingAccessibilityUnconfirmed).toBe(true);
  });
});
