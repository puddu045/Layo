import type { MatchingConfig } from '@layo/config';
import type { Match, MatchCategory, PublicProfile } from '@layo/contracts';
import { computePresenceWindows, overlapMinutes, type PresenceSegmentInput, type PresenceWindow } from './presence.util';

export interface CandidateTraveller {
  userId: string;
  profile: PublicProfile;
  segments: PresenceSegmentInput[];
  connectionStatus: Match['connectionStatus'];
}

export interface ComputeMatchesParams {
  requesterWindows: PresenceWindow[];
  requesterFlightIds: Set<string>;
  /** Already filtered by the caller to exclude the requester, blocked users, and
   * non-discoverable profiles/journeys. */
  candidates: CandidateTraveller[];
  config: MatchingConfig;
  now: Date;
}

/**
 * Pure matching core — no I/O, fully deterministic given its inputs, which is
 * what makes it unit-testable without a database.
 *
 * Category assignment is from the REQUESTING user's point of view: if the
 * requester's own presence at an airport is a layover, any traveller who
 * overlaps it is reported under SAME_LAYOVER_AIRPORT, even if that other
 * traveller is just departing from (not connecting through) that same
 * airport. This keeps "what kind of match is this, for me" simple and
 * consistent, and is documented in docs/DECISIONS.md.
 */
export function computeMatches(params: ComputeMatchesParams): Match[] {
  const sameFlightUserIds = new Set<string>();
  const best = new Map<string, Match>();

  // 1. Same flight — includes codeshares, since they share a canonical flight id.
  for (const candidate of params.candidates) {
    const sharedSegment = candidate.segments.find((seg) => params.requesterFlightIds.has(seg.flightId));
    if (!sharedSegment) continue;
    if (sharedSegment.scheduledArrivalUtc.getTime() < params.now.getTime()) continue;

    const key = `SAME_FLIGHT:${candidate.userId}:${sharedSegment.flightId}`;
    best.set(key, {
      category: 'SAME_FLIGHT',
      profile: candidate.profile,
      flightNumber: sharedSegment.flightNumber,
      overlapStartUtc: sharedSegment.scheduledDepartureUtc.toISOString(),
      overlapEndUtc: sharedSegment.scheduledArrivalUtc.toISOString(),
      overlapMinutes: Math.round(
        (sharedSegment.scheduledArrivalUtc.getTime() - sharedSegment.scheduledDepartureUtc.getTime()) / 60_000,
      ),
      meetingAccessibilityUnconfirmed: true,
      connectionStatus: candidate.connectionStatus,
    });
    sameFlightUserIds.add(candidate.userId);
  }

  // 2. Airport presence overlaps (departure or layover), categorised by the requester's own window type.
  for (const window of params.requesterWindows) {
    for (const candidate of params.candidates) {
      if (sameFlightUserIds.has(candidate.userId)) continue;

      const candidateWindows = computePresenceWindows(candidate.segments, params.config);
      for (const candidateWindow of candidateWindows) {
        if (candidateWindow.airportIata !== window.airportIata) continue;

        const overlap = overlapMinutes(window.start, window.end, candidateWindow.start, candidateWindow.end);
        if (overlap < params.config.minAirportOverlapMinutes) continue;

        const overlapStart = new Date(Math.max(window.start.getTime(), candidateWindow.start.getTime()));
        const overlapEnd = new Date(Math.min(window.end.getTime(), candidateWindow.end.getTime()));
        if (overlapEnd.getTime() < params.now.getTime()) continue;

        const category: MatchCategory = window.type === 'LAYOVER' ? 'SAME_LAYOVER_AIRPORT' : 'SAME_DEPARTURE_AIRPORT';
        const key = `${category}:${candidate.userId}:${window.airportIata}`;
        const existing = best.get(key);
        if (existing && existing.overlapMinutes >= overlap) continue;

        best.set(key, {
          category,
          profile: candidate.profile,
          airportIata: window.airportIata,
          overlapStartUtc: overlapStart.toISOString(),
          overlapEndUtc: overlapEnd.toISOString(),
          overlapMinutes: overlap,
          meetingAccessibilityUnconfirmed: true,
          connectionStatus: candidate.connectionStatus,
        });
      }
    }
  }

  return [...best.values()];
}
