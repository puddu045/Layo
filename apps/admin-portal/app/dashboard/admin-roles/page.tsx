'use client';

import { useEffect, useState } from 'react';
import type { AdminAccount, AdminRole, AdminUserListItem } from '@layo/contracts';
import { api, ApiError } from '../../../lib/api-client';
import { useCurrentUser } from '../../../lib/use-current-user';

const ROLES: AdminRole[] = ['SUPER_ADMIN', 'MODERATOR', 'BUSINESS_MANAGER'];

export default function AdminRolesPage() {
  const me = useCurrentUser();
  const isSuperAdmin = me?.adminRole === 'SUPER_ADMIN';

  const [admins, setAdmins] = useState<AdminAccount[] | undefined>();
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<AdminUserListItem[]>([]);
  const [grantRole, setGrantRole] = useState<AdminRole>('MODERATOR');
  const [error, setError] = useState<string | undefined>();

  const refresh = () => {
    api.get<AdminAccount[]>('/admin-accounts').then(setAdmins);
  };

  useEffect(refresh, []);

  useEffect(() => {
    if (!search.trim()) {
      setCandidates([]);
      return;
    }
    const handle = setTimeout(() => {
      api
        .get<{ items: AdminUserListItem[] }>(`/users?search=${encodeURIComponent(search.trim())}&pageSize=5`)
        .then((res) => setCandidates(res.items.filter((u) => !u.isAdmin)));
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  const changeRole = async (userId: string, role: AdminRole | null) => {
    setError(undefined);
    try {
      await api.patch(`/admin-accounts/${userId}/role`, { role });
      setSearch('');
      setCandidates([]);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update role');
    }
  };

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-navy-900">Admin Roles</h2>
      <p className="mb-6 text-sm text-slate-500">
        Super Admin has full access. Moderator covers users, reports, and airport chats. Business Manager covers
        businesses and deals. Only a Super Admin can change roles.
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {admins === undefined ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <ul className="mb-6 space-y-2">
          {admins.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
              <div>
                <p className="text-sm font-semibold text-navy-900">{a.displayName ?? a.email}</p>
                <p className="text-xs text-slate-500">{a.email}</p>
              </div>
              {isSuperAdmin ? (
                <div className="flex items-center gap-2">
                  <select
                    value={a.role}
                    onChange={(e) => changeRole(a.id, e.target.value as AdminRole)}
                    className="input w-44"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (window.confirm(`Revoke admin access for ${a.email}?`)) changeRole(a.id, null);
                    }}
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Revoke
                  </button>
                </div>
              ) : (
                <span className="rounded-full bg-navy-500 px-2.5 py-0.5 text-xs font-semibold text-white">{a.role}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {isSuperAdmin && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-3 text-sm font-semibold text-navy-900">Grant admin access</h3>
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search a user by email or name…"
              className="input flex-1"
            />
            <select value={grantRole} onChange={(e) => setGrantRole(e.target.value as AdminRole)} className="input w-44">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {candidates.length > 0 && (
            <ul className="mt-3 space-y-1">
              {candidates.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span>{c.displayName ?? c.email}</span>
                  <button onClick={() => changeRole(c.id, grantRole)} className="text-xs font-semibold text-teal-600 hover:underline">
                    Grant {grantRole}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
