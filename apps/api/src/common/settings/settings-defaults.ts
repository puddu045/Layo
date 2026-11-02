import type { Settings, SettingsCategory } from '@layo/contracts';

/** Compiled-in defaults for every settings category — used whenever no `AppSetting` row exists
 * yet for that category, and as the base a stored partial is merged over. */
export const SETTINGS_DEFAULTS: Settings = {
  moderation: { warningThreshold: 3, escalationThreshold: 10 },
  matching: {
    enabled: true,
    departureAirportWindowMinutesBefore: 180,
    departureAirportWindowMinutesAfter: 30,
    minAirportOverlapMinutes: 30,
  },
  airportChat: { enabled: true, accessWindowHoursBefore: 6, accessWindowHoursAfter: 4 },
  featureFlags: { businessSelfSignup: true },
};

/** A stored row is always a *partial* override — merging it over the category's defaults is
 * what makes "nothing saved yet" behave identically to "saved, but matches the defaults". */
export function mergeSettingsCategory<K extends SettingsCategory>(
  category: K,
  stored: Partial<Settings[K]> | null | undefined,
): Settings[K] {
  return { ...SETTINGS_DEFAULTS[category], ...stored } as Settings[K];
}
