import { describe, expect, it } from 'vitest';
import { mergeSettingsCategory, SETTINGS_DEFAULTS } from './settings-defaults';

describe('mergeSettingsCategory', () => {
  it('returns the compiled-in defaults when nothing is stored', () => {
    expect(mergeSettingsCategory('moderation', undefined)).toEqual(SETTINGS_DEFAULTS.moderation);
    expect(mergeSettingsCategory('moderation', null)).toEqual(SETTINGS_DEFAULTS.moderation);
  });

  it('overlays a partial stored value over the defaults, field by field', () => {
    expect(mergeSettingsCategory('moderation', { warningThreshold: 5 })).toEqual({
      warningThreshold: 5,
      escalationThreshold: SETTINGS_DEFAULTS.moderation.escalationThreshold,
    });
  });

  it('a full stored value fully overrides the defaults', () => {
    const full = { enabled: false, accessWindowHoursBefore: 1, accessWindowHoursAfter: 1 };
    expect(mergeSettingsCategory('airportChat', full)).toEqual(full);
  });
});
