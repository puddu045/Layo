import { describe, expect, it } from 'vitest';
import { nextBusinessStatus } from './business-status.util';

describe('nextBusinessStatus', () => {
  it('approves a pending business', () => {
    expect(nextBusinessStatus('PENDING', 'APPROVE')).toBe('APPROVED');
  });

  it('rejects a pending business', () => {
    expect(nextBusinessStatus('PENDING', 'REJECT')).toBe('REJECTED');
  });

  it('suspends an approved business', () => {
    expect(nextBusinessStatus('APPROVED', 'SUSPEND')).toBe('SUSPENDED');
  });

  it('reinstates a suspended business', () => {
    expect(nextBusinessStatus('SUSPENDED', 'REINSTATE')).toBe('APPROVED');
  });

  it('rejects approving a business that is not pending', () => {
    expect(nextBusinessStatus('APPROVED', 'APPROVE')).toBeNull();
    expect(nextBusinessStatus('REJECTED', 'APPROVE')).toBeNull();
    expect(nextBusinessStatus('SUSPENDED', 'APPROVE')).toBeNull();
  });

  it('rejects suspending a business that is not approved', () => {
    expect(nextBusinessStatus('PENDING', 'SUSPEND')).toBeNull();
    expect(nextBusinessStatus('REJECTED', 'SUSPEND')).toBeNull();
    expect(nextBusinessStatus('SUSPENDED', 'SUSPEND')).toBeNull();
  });

  it('rejects reinstating a business that is not suspended', () => {
    expect(nextBusinessStatus('PENDING', 'REINSTATE')).toBeNull();
    expect(nextBusinessStatus('APPROVED', 'REINSTATE')).toBeNull();
    expect(nextBusinessStatus('REJECTED', 'REINSTATE')).toBeNull();
  });
});
