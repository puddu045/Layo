import type { Layover } from '@layo/contracts';

export interface SegmentTimingInput {
  sequence: number;
  departureAirportIata: string;
  arrivalAirportIata: string;
  scheduledDepartureUtc: Date;
  scheduledArrivalUtc: Date;
}

/**
 * Computes layovers between consecutive segments of a journey. A layover only
 * exists between segment N and N+1 when segment N's arrival airport is the
 * same as segment N+1's departure airport — i.e. a genuine connection, not an
 * unrelated later trip. Segments must already be sorted by `sequence`.
 */
export function computeLayovers(segments: SegmentTimingInput[]): Layover[] {
  const layovers: Layover[] = [];

  for (let i = 0; i < segments.length - 1; i += 1) {
    const current = segments[i]!;
    const next = segments[i + 1]!;

    if (current.arrivalAirportIata !== next.departureAirportIata) continue;

    const durationMinutes = Math.round(
      (next.scheduledDepartureUtc.getTime() - current.scheduledArrivalUtc.getTime()) / 60_000,
    );

    layovers.push({
      airportIata: current.arrivalAirportIata,
      arrivalUtc: current.scheduledArrivalUtc.toISOString(),
      departureUtc: next.scheduledDepartureUtc.toISOString(),
      durationMinutes,
    });
  }

  return layovers;
}
