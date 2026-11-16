'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { AdminUserDetail } from '@layo/contracts';
import { api } from '../../../../lib/api-client';
import { StatusBadge } from '../../../../components/StatusBadge';
import { useCurrentUser } from '../../../../lib/use-current-user';

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useCurrentUser();
  const [user, setUser] = useState<AdminUserDetail | undefined>();
  const [acting, setActing] = useState(false);
  const [reason, setReason] = useState('');

  const refresh = () => {
    api.get<AdminUserDetail>(`/users/${id}/admin`).then(setUser);
  };

  useEffect(refresh, [id]);

  const act = async (
    action: 'warn' | 'suspend' | 'ban' | 'reinstate' | 'verify' | 'delete' | 'hard-delete',
    confirmMessage?: string,
  ) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setActing(true);
    try {
      const body = action === 'verify' ? undefined : { reason: reason || undefined };
      if (action === 'hard-delete') {
        await api.delete(`/users/${id}/hard-delete`, body);
      } else {
        await api.patch(`/users/${id}/${action}`, body);
      }
      setReason('');
      if (action === 'delete' || action === 'hard-delete') {
        router.push('/dashboard/users');
        return;
      }
      refresh();
    } finally {
      setActing(false);
    }
  };

  if (!user) return <p className="text-sm text-slate-400">Loading…</p>;

  // A Super Admin account can't be suspended, banned, or deleted (see `UsersService`'s matching
  // guard) — hiding these here instead of just letting the click 400 is the actual UX fix.
  const isSuperAdminTarget = user.adminRole === 'SUPER_ADMIN';

  return (
    <div>
      <button onClick={() => router.push('/dashboard/users')} className="mb-4 text-sm text-slate-500 hover:text-navy-900">
        ← Back to users
      </button>

      <div className="mb-6 rounded-lg border border-border bg-surface p-5">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-bold text-navy-900">{user.displayName ?? user.email}</h2>
          <StatusBadge status={user.status} />
          {user.verifiedAt && <span className="text-xs font-semibold text-teal-600">Verified</span>}
          {user.isAdmin && <span className="text-xs font-semibold text-navy-500">{user.adminRole}</span>}
        </div>
        <p className="text-sm text-slate-600">{user.email}</p>
        <p className="mt-1 text-xs text-slate-400">Joined {new Date(user.createdAt).toLocaleString()}</p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Journeys" value={user.journeysCount} />
          <Stat label="Connections" value={user.connectionsCount} />
          <Stat label="Reports filed" value={user.reportsFiledCount} />
          <Stat label="Reports received" value={user.reportsReceivedCount} />
        </div>

        <div className="mt-5">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional, shown in audit log)"
            className="input mb-3"
          />
          <div className="flex flex-wrap gap-2">
            <ActionButton label="Warn" onClick={() => act('warn')} disabled={acting} />
            {!user.verifiedAt && <ActionButton label="Verify" onClick={() => act('verify')} disabled={acting} />}
            {user.status === 'ACTIVE' && !isSuperAdminTarget && (
              <>
                <ActionButton label="Suspend" danger onClick={() => act('suspend', 'Suspend this account? They will be signed out immediately.')} disabled={acting} />
                <ActionButton
                  label="Ban permanently"
                  danger
                  onClick={() => act('ban', 'Ban this account permanently? Their email will be blocked from re-registering.')}
                  disabled={acting}
                />
              </>
            )}
            {user.status === 'SUSPENDED' && (
              <ActionButton label="Reinstate" onClick={() => act('reinstate')} disabled={acting} />
            )}
            {user.status !== 'DELETED' && !isSuperAdminTarget && (
              <ActionButton
                label="Delete profile completely"
                danger
                onClick={() =>
                  act(
                    'delete',
                    'Permanently delete this profile? Their display name, bio, photo and contact details will be erased and they will be signed out immediately. This cannot be undone.',
                  )
                }
                disabled={acting}
              />
            )}
            {me?.adminRole === 'SUPER_ADMIN' && !isSuperAdminTarget && (
              <ActionButton
                label="Hard delete account"
                danger
                onClick={() =>
                  act(
                    'hard-delete',
                    `Permanently erase ${user.email}? This removes the account from Supabase Auth and this database entirely — all of their rows (profile, journeys, connections, messages sent, etc.) are gone for good, and that email becomes free to register again from scratch. This cannot be undone.`,
                  )
                }
                disabled={acting}
              />
            )}
          </div>
          {isSuperAdminTarget && (
            <p className="mt-2 text-xs text-slate-400">
              This is a Super Admin account — it can&rsquo;t be suspended, banned, or deleted. Remove their Super
              Admin role from the Admins page first if that&rsquo;s really intended.
            </p>
          )}
          {!isSuperAdminTarget && me?.adminRole === 'SUPER_ADMIN' && (
            <p className="mt-2 text-xs text-slate-400">
              &ldquo;Delete profile completely&rdquo; scrubs and locks the account but keeps the row. &ldquo;Hard delete
              account&rdquo; removes it everywhere, including Supabase Auth — use this when the email needs to be free
              to register again.
            </p>
          )}
        </div>
      </div>

      <h3 className="mb-2 text-sm font-semibold text-navy-900">Account history</h3>
      {user.history.length === 0 ? (
        <p className="text-sm text-slate-400">No moderation history for this account.</p>
      ) : (
        <ul className="space-y-2 rounded-lg border border-border bg-surface p-4">
          {user.history.map((h) => (
            <li key={h.id} className="text-sm">
              <span className="font-semibold text-navy-900">{h.actorEmail ?? 'System'}</span>{' '}
              <span className="text-slate-600">{h.action.toLowerCase()}</span>{' '}
              <span className="text-xs text-slate-400">{new Date(h.createdAt).toLocaleString()}</span>
              {h.metadata?.reason ? <p className="text-xs text-slate-500">&ldquo;{String(h.metadata.reason)}&rdquo;</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-lg font-bold text-navy-900">{value}</p>
    </div>
  );
}

function ActionButton({ label, onClick, danger, disabled }: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
        danger ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'
      }`}
    >
      {label}
    </button>
  );
}
