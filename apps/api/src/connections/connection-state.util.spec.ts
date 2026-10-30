import { describe, expect, it } from 'vitest';
import { decideConnectRequestAction } from './connection-state.util';

describe('decideConnectRequestAction', () => {
  it('creates a fresh request when no connection exists', () => {
    expect(decideConnectRequestAction(null)).toEqual({ type: 'CREATE' });
  });

  it('rejects when a request is already pending from me to them', () => {
    const result = decideConnectRequestAction({ id: 'c1', status: 'PENDING', direction: 'ME_TO_OTHER' });
    expect(result).toEqual({ type: 'REJECT', reason: 'ALREADY_PENDING' });
  });

  it('auto-accepts when they already sent me a pending request', () => {
    const result = decideConnectRequestAction({ id: 'c1', status: 'PENDING', direction: 'OTHER_TO_ME' });
    expect(result).toEqual({ type: 'AUTO_ACCEPT', existingId: 'c1' });
  });

  it('rejects when already connected, regardless of original direction', () => {
    expect(decideConnectRequestAction({ id: 'c1', status: 'ACCEPTED', direction: 'ME_TO_OTHER' })).toEqual({
      type: 'REJECT',
      reason: 'ALREADY_CONNECTED',
    });
    expect(decideConnectRequestAction({ id: 'c1', status: 'ACCEPTED', direction: 'OTHER_TO_ME' })).toEqual({
      type: 'REJECT',
      reason: 'ALREADY_CONNECTED',
    });
  });

  it('reopens a previously declined request instead of creating a duplicate row', () => {
    const result = decideConnectRequestAction({ id: 'c1', status: 'DECLINED', direction: 'OTHER_TO_ME' });
    expect(result).toEqual({ type: 'REOPEN', existingId: 'c1' });
  });

  it('reopens a previously cancelled request instead of creating a duplicate row', () => {
    const result = decideConnectRequestAction({ id: 'c1', status: 'CANCELLED', direction: 'ME_TO_OTHER' });
    expect(result).toEqual({ type: 'REOPEN', existingId: 'c1' });
  });
});
