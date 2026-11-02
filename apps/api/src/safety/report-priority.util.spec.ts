import { describe, expect, it } from 'vitest';
import { computeReportPriority } from './report-priority.util';

const thresholds = { warningThreshold: 3, escalationThreshold: 10 };

describe('computeReportPriority', () => {
  it('is LOW for a routine reason below the warning threshold', () => {
    expect(computeReportPriority('SPAM', 1, thresholds)).toBe('LOW');
    expect(computeReportPriority('SPAM', 2, thresholds)).toBe('LOW');
  });

  it('is MEDIUM for a routine reason at or above the warning threshold', () => {
    expect(computeReportPriority('HARASSMENT', 3, thresholds)).toBe('MEDIUM');
    expect(computeReportPriority('HARASSMENT', 9, thresholds)).toBe('MEDIUM');
  });

  it('is CRITICAL at or above the escalation threshold, regardless of reason', () => {
    expect(computeReportPriority('OTHER', 10, thresholds)).toBe('CRITICAL');
    expect(computeReportPriority('OTHER', 25, thresholds)).toBe('CRITICAL');
  });

  it('never returns CRITICAL from reason severity alone, however few reporters', () => {
    expect(computeReportPriority('SAFETY_CONCERN', 1, thresholds)).not.toBe('CRITICAL');
  });

  it('bumps a safety concern up a tier relative to a routine reason at the same count', () => {
    expect(computeReportPriority('SAFETY_CONCERN', 1, thresholds)).toBe('MEDIUM');
    expect(computeReportPriority('SPAM', 1, thresholds)).toBe('LOW');

    expect(computeReportPriority('SAFETY_CONCERN', 3, thresholds)).toBe('HIGH');
    expect(computeReportPriority('SPAM', 3, thresholds)).toBe('MEDIUM');
  });

  it('still escalates a safety concern to CRITICAL once it hits the escalation threshold', () => {
    expect(computeReportPriority('SAFETY_CONCERN', 10, thresholds)).toBe('CRITICAL');
  });
});
