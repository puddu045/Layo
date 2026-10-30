export interface PresenceSegmentInput {
  sequence: number;
  departureAirportIata: string;
  arrivalAirportIata: string;
  scheduledDepartureUtc: Date;
  scheduledArrivalUtc: Date;
  flightId: string;
  flightNumber: string;
}

export type PresenceWindowType = 'DEPARTURE' | 'LAYOVER';

export interface PresenceWindow {
  airportIata: string;
  type: PresenceWindowType;
  start: Date;
  end: Date;
  flightId: string;
  flightNumber: string;
}

export interface DepartureWindowConfig {
  departureAirportWindowMinutesBefore: number;
  departureAirportWindowMinutesAfter: number;
}

/**
 * Derives every airport "presence window" implied by an ordered list of
 * journey segments: a LAYOVER window between two connecting segments (arrival
 * airport of one equals departure airport of the next), or a DEPARTURE window
 * around any other departure (the true origin of a trip, or a departure after
 * a gap that isn't a same-airport connection).
 *
 * `segments` need not be pre-sorted — this sorts by `sequence` itself.
 */
export function computePresenceWindows(
  segments: PresenceSegmentInput[],
  config: DepartureWindowConfig,
): PresenceWindow[] {
  const sorted = [...segments].sort((a, b) => a.sequence - b.sequence);
  const windows: PresenceWindow[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const segment = sorted[i]!;
    const previous = sorted[i - 1];
    const isLayover = previous !== undefined && previous.arrivalAirportIata === segment.departureAirportIata;

    if (isLayover) {
      windows.push({
        airportIata: segment.departureAirportIata,
        type: 'LAYOVER',
        start: previous!.scheduledArrivalUtc,
        end: segment.scheduledDepartureUtc,
        flightId: segment.flightId,
        flightNumber: segment.flightNumber,
      });
    } else {
      windows.push({
        airportIata: segment.departureAirportIata,
        type: 'DEPARTURE',
        start: new Date(
          segment.scheduledDepartureUtc.getTime() - config.departureAirportWindowMinutesBefore * 60_000,
        ),
        end: new Date(segment.scheduledDepartureUtc.getTime() + config.departureAirportWindowMinutesAfter * 60_000),
        flightId: segment.flightId,
        flightNumber: segment.flightNumber,
      });
    }
  }

  return windows;
}

/** Overlap, in whole minutes, between two time ranges. 0 (never negative) when they don't overlap. */
export function overlapMinutes(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  if (end <= start) return 0;
  return Math.round((end - start) / 60_000);
}
