export type BusinessStatusValue = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type BusinessStatusAction = 'APPROVE' | 'REJECT' | 'SUSPEND' | 'REINSTATE';

/**
 * Decides whether an admin action is valid against a business's current
 * status, and what status it leads to. Returns `null` for an invalid
 * transition (e.g. approving an already-approved business) so the caller can
 * reject it with a clear error instead of silently no-opping.
 */
export function nextBusinessStatus(
  current: BusinessStatusValue,
  action: BusinessStatusAction,
): BusinessStatusValue | null {
  switch (action) {
    case 'APPROVE':
      return current === 'PENDING' ? 'APPROVED' : null;
    case 'REJECT':
      return current === 'PENDING' ? 'REJECTED' : null;
    case 'SUSPEND':
      return current === 'APPROVED' ? 'SUSPENDED' : null;
    case 'REINSTATE':
      return current === 'SUSPENDED' ? 'APPROVED' : null;
  }
}
