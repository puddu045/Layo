import type { ReportPriority, ReportReason } from '@layo/contracts';

export interface PriorityThresholds {
  warningThreshold: number;
  escalationThreshold: number;
}

/**
 * Priority is always derived from the *reported user's* distinct-reporter count plus how
 * severe the reason itself is — never from a single report's count in isolation, and the
 * CRITICAL tier means "needs admin review now", never "ban now" (see `ReportsService`, which
 * never auto-bans). A safety concern is bumped up a tier relative to a routine report at the
 * same report count, since it deserves faster attention even early on.
 */
export function computeReportPriority(
  reason: ReportReason,
  distinctReporterCount: number,
  thresholds: PriorityThresholds,
): ReportPriority {
  if (distinctReporterCount >= thresholds.escalationThreshold) {
    return 'CRITICAL';
  }

  const isSafetyConcern = reason === 'SAFETY_CONCERN';

  if (distinctReporterCount >= thresholds.warningThreshold) {
    return isSafetyConcern ? 'HIGH' : 'MEDIUM';
  }

  return isSafetyConcern ? 'MEDIUM' : 'LOW';
}
