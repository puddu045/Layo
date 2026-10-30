export type ConnectionStatusValue = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';

/** Direction of an existing connection row, relative to the person about to send a new request. */
export type ExistingConnectionDirection = 'ME_TO_OTHER' | 'OTHER_TO_ME';

export interface ExistingConnectionInfo {
  id: string;
  status: ConnectionStatusValue;
  direction: ExistingConnectionDirection;
}

export type ConnectRequestAction =
  | { type: 'CREATE' }
  | { type: 'AUTO_ACCEPT'; existingId: string }
  | { type: 'REOPEN'; existingId: string }
  | { type: 'REJECT'; reason: 'ALREADY_PENDING' | 'ALREADY_CONNECTED' };

/**
 * Decides what sending a connection request should actually do, given whatever
 * connection row (if any) already exists between the two users — in either
 * direction, since the unique (requesterId, addresseeId) constraint means a
 * prior request the *other* way doesn't show up as a naive duplicate.
 *
 * - No existing row → create a fresh PENDING request.
 * - They already sent *me* a pending request → treat my "connect" as
 *   accepting theirs, rather than creating a second, reversed row.
 * - A row already exists PENDING from me, or ACCEPTED (either direction) →
 *   reject; nothing to do.
 * - The only existing row was DECLINED or CANCELLED → reopen it as a fresh
 *   PENDING request from me, rather than accumulating duplicate rows for the
 *   same pair of users over time.
 */
export function decideConnectRequestAction(existing: ExistingConnectionInfo | null): ConnectRequestAction {
  if (!existing) return { type: 'CREATE' };

  if (existing.status === 'ACCEPTED') {
    return { type: 'REJECT', reason: 'ALREADY_CONNECTED' };
  }

  if (existing.status === 'PENDING') {
    if (existing.direction === 'OTHER_TO_ME') {
      return { type: 'AUTO_ACCEPT', existingId: existing.id };
    }
    return { type: 'REJECT', reason: 'ALREADY_PENDING' };
  }

  // DECLINED or CANCELLED — reopen rather than create a second row for this pair.
  return { type: 'REOPEN', existingId: existing.id };
}
