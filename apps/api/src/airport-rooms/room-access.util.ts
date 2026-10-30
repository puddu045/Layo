import type { PresenceWindow } from '../matching/presence.util';

export interface RoomAccessWindowConfig {
  accessWindowHoursBefore: number;
  accessWindowHoursAfter: number;
}

export interface RoomAccessWindow {
  airportIata: string;
  start: Date;
  end: Date;
}

/**
 * Expands each matching-style presence window into a (usually much wider)
 * airport-room access window: `accessWindowHoursBefore` lets a traveller read
 * and post ahead of actually being there — "support planning a meetup before
 * arrival" — and `accessWindowHoursAfter` gives a grace period once they've
 * moved on, rather than cutting access off the instant they depart.
 */
export function computeRoomAccessWindows(
  presenceWindows: PresenceWindow[],
  config: RoomAccessWindowConfig,
): RoomAccessWindow[] {
  return presenceWindows.map((w) => ({
    airportIata: w.airportIata,
    start: new Date(w.start.getTime() - config.accessWindowHoursBefore * 3_600_000),
    end: new Date(w.end.getTime() + config.accessWindowHoursAfter * 3_600_000),
  }));
}

/** The window covering `now` for this airport, if any — a traveller is eligible right now. */
export function findActiveWindow(windows: RoomAccessWindow[], airportIata: string, now: Date): RoomAccessWindow | undefined {
  return windows.find((w) => w.airportIata === airportIata && now >= w.start && now <= w.end);
}

/** The active window if there is one, otherwise the soonest upcoming window — used to tell a
 * not-yet-eligible user when the room will open for them. */
export function findActiveOrNextWindow(
  windows: RoomAccessWindow[],
  airportIata: string,
  now: Date,
): RoomAccessWindow | undefined {
  const active = findActiveWindow(windows, airportIata, now);
  if (active) return active;

  return windows
    .filter((w) => w.airportIata === airportIata && w.start > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
}
