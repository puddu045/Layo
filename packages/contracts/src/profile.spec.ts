import { describe, expect, it, vi } from 'vitest';
import { calculateAge, dateOfBirthSchema } from './profile';

describe('calculateAge', () => {
  it('counts a full year before the birthday has occurred this year', () => {
    expect(calculateAge('2000-06-15', new Date('2025-06-14T00:00:00Z'))).toBe(24);
  });

  it('counts the extra year once the birthday has occurred', () => {
    expect(calculateAge('2000-06-15', new Date('2025-06-15T00:00:00Z'))).toBe(25);
  });
});

describe('dateOfBirthSchema (18+ enforcement)', () => {
  it('rejects someone who turns 18 tomorrow', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-14T00:00:00Z'));
    const result = dateOfBirthSchema.safeParse('2007-06-15');
    expect(result.success).toBe(false);
    vi.useRealTimers();
  });

  it('accepts someone who turned 18 today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T00:00:00Z'));
    const result = dateOfBirthSchema.safeParse('2007-06-15');
    expect(result.success).toBe(true);
    vi.useRealTimers();
  });

  it('rejects an obviously underage date of birth', () => {
    const result = dateOfBirthSchema.safeParse('2015-01-01');
    expect(result.success).toBe(false);
  });
});
