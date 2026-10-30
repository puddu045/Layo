import { describe, expect, it } from 'vitest';
import { computeRoomAccessWindows, findActiveOrNextWindow, findActiveWindow } from './room-access.util';
import type { PresenceWindow } from '../matching/presence.util';

const config = { accessWindowHoursBefore: 6, accessWindowHoursAfter: 4 };

const dxbLayover: PresenceWindow = {
  airportIata: 'DXB',
  type: 'LAYOVER',
  start: new Date('2026-06-02T04:30:00Z'),
  end: new Date('2026-06-02T07:00:00Z'),
  flightId: 'flight-2',
  flightNumber: 'EK567',
};

describe('computeRoomAccessWindows', () => {
  it('widens the presence window by the configured before/after hours', () => {
    const [window] = computeRoomAccessWindows([dxbLayover], config);
    expect(window.airportIata).toBe('DXB');
    expect(window.start.toISOString()).toBe('2026-06-01T22:30:00.000Z'); // 04:30 - 6h
    expect(window.end.toISOString()).toBe('2026-06-02T11:00:00.000Z'); // 07:00 + 4h
  });
});

describe('findActiveWindow', () => {
  const windows = computeRoomAccessWindows([dxbLayover], config);

  it('finds the window when now falls inside it, even well before the actual layover', () => {
    const now = new Date('2026-06-02T00:00:00Z'); // within the +6h pre-window, before arrival
    expect(findActiveWindow(windows, 'DXB', now)).toBeDefined();
  });

  it('returns undefined once well past the grace period', () => {
    const now = new Date('2026-06-03T00:00:00Z');
    expect(findActiveWindow(windows, 'DXB', now)).toBeUndefined();
  });

  it('returns undefined for a different airport entirely', () => {
    const now = new Date('2026-06-02T05:00:00Z');
    expect(findActiveWindow(windows, 'LHR', now)).toBeUndefined();
  });
});

describe('findActiveOrNextWindow', () => {
  const windows = computeRoomAccessWindows([dxbLayover], config);

  it('prefers the active window when there is one', () => {
    const now = new Date('2026-06-02T05:00:00Z');
    const found = findActiveOrNextWindow(windows, 'DXB', now);
    expect(found?.start.toISOString()).toBe('2026-06-01T22:30:00.000Z');
  });

  it('falls back to the soonest future window when not currently eligible', () => {
    const now = new Date('2026-05-01T00:00:00Z'); // long before the window opens
    const found = findActiveOrNextWindow(windows, 'DXB', now);
    expect(found?.start.toISOString()).toBe('2026-06-01T22:30:00.000Z');
  });

  it('returns undefined once every window for that airport is in the past', () => {
    const now = new Date('2026-07-01T00:00:00Z');
    expect(findActiveOrNextWindow(windows, 'DXB', now)).toBeUndefined();
  });
});
