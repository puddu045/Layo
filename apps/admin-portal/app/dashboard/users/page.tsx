'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AdminUserListItem, AdminUserStatus, PaginatedResponse } from '@layo/contracts';
import { api } from '../../../lib/api-client';
import { StatusBadge } from '../../../components/StatusBadge';

const FILTERS: Array<AdminUserStatus | 'ALL'> = ['ACTIVE', 'SUSPENDED', 'DELETED', 'ALL'];

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AdminUserStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedResponse<AdminUserListItem> | undefined>();

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (search.trim()) params.set('search', search.trim());
    if (filter !== 'ALL') params.set('status', filter);
    api.get<PaginatedResponse<AdminUserListItem>>(`/users?${params.toString()}`).then(setData);
  }, [search, filter, page]);

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-navy-900">Users</h2>
      <p className="mb-4 text-sm text-slate-500">Search travellers, review activity, and take moderation action.</p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search by email or name…"
          className="input max-w-xs"
        />
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => {
                setPage(1);
                setFilter(f);
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                filter === f ? 'bg-navy-900 text-white' : 'bg-surface text-slate-600 border border-border'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {data === undefined ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : data.items.length === 0 ? (
        <p className="text-sm text-slate-400">No users match.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {data.items.map((u) => (
              <li key={u.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
                <div>
                  <p className="text-sm font-semibold text-navy-900">
                    {u.displayName ?? u.email}
                    {u.verifiedAt && <span className="ml-2 text-xs font-medium text-teal-600">Verified</span>}
                    {u.isAdmin && <span className="ml-2 text-xs font-medium text-navy-500">{u.adminRole}</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {u.email} · {u.reportsReceivedCount} report{u.reportsReceivedCount === 1 ? '' : 's'} received · joined{' '}
                    {new Date(u.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={u.status} />
                  <Link href={`/dashboard/users/${u.id}`} className="rounded-lg bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-700">
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>
              Page {data.page} of {data.totalPages} · {data.total} users
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-border px-3 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-border px-3 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
