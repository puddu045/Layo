'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Appeal, AppealStatus } from '@layo/contracts';
import { api } from '../../../../lib/api-client';
import { StatusBadge } from '../../../../components/StatusBadge';

const FILTERS: Array<AppealStatus | 'ALL'> = ['PENDING', 'APPROVED', 'DENIED', 'ALL'];

export default function AppealsPage() {
  const [filter, setFilter] = useState<AppealStatus | 'ALL'>('PENDING');
  const [appeals, setAppeals] = useState<Appeal[] | undefined>();
  const [acting, setActing] = useState<string | undefined>();

  const refresh = () => {
    const query = filter === 'ALL' ? '' : `?status=${filter}`;
    api.get<Appeal[]>(`/appeals${query}`).then(setAppeals);
  };

  useEffect(refresh, [filter]);

  const resolve = async (id: string, approve: boolean) => {
    if (!window.confirm(approve ? 'Approve this appeal and reinstate the account?' : 'Deny this appeal?')) return;
    setActing(id);
    try {
      await api.patch(`/appeals/${id}/resolve`, { approve });
      refresh();
    } finally {
      setActing(undefined);
    }
  };

  return (
    <div>
      <Link href="/dashboard/reports" className="mb-4 inline-block text-sm text-slate-500 hover:text-navy-900">
        ← Back to reports
      </Link>
      <h2 className="mb-2 text-2xl font-bold text-navy-900">Ban appeals</h2>
      <p className="mb-4 text-sm text-slate-500">
        A suspended or banned account can&apos;t sign in to appeal from inside the app, so this is filed by email
        instead. Approving reinstates the account immediately.
      </p>

      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              filter === f ? 'bg-navy-900 text-white' : 'bg-surface text-slate-600 border border-border'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {appeals === undefined ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : appeals.length === 0 ? (
        <p className="text-sm text-slate-400">No appeals here.</p>
      ) : (
        <ul className="space-y-2">
          {appeals.map((a) => (
            <li key={a.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-navy-900">{a.email}</p>
                  <p className="mt-1 text-sm text-slate-600">&ldquo;{a.message}&rdquo;</p>
                  <p className="mt-1 text-xs text-slate-400">Filed {new Date(a.createdAt).toLocaleString()}</p>
                </div>
                <StatusBadge status={a.status} />
              </div>
              {a.status === 'PENDING' && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => resolve(a.id, true)}
                    disabled={acting === a.id}
                    className="rounded-lg bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-700 disabled:opacity-50"
                  >
                    Approve & reinstate
                  </button>
                  <button
                    onClick={() => resolve(a.id, false)}
                    disabled={acting === a.id}
                    className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                  >
                    Deny
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
