'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SupportStatus, SupportTicketListItem } from '@layo/contracts';
import { api } from '../../../lib/api-client';
import { StatusBadge } from '../../../components/StatusBadge';

const FILTERS: Array<SupportStatus | 'ALL'> = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ALL'];

export default function SupportPage() {
  const [filter, setFilter] = useState<SupportStatus | 'ALL'>('OPEN');
  const [tickets, setTickets] = useState<SupportTicketListItem[] | undefined>();

  useEffect(() => {
    const query = filter === 'ALL' ? '' : `?status=${filter}`;
    api.get<SupportTicketListItem[]>(`/support/tickets${query}`).then(setTickets);
  }, [filter]);

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-navy-900">Support</h2>
      <p className="mb-4 text-sm text-slate-500">User feedback, bug reports, and support tickets.</p>

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

      {tickets === undefined ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-slate-400">No tickets here.</p>
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
              <div>
                <p className="text-sm font-semibold text-navy-900">{t.subject}</p>
                <p className="text-xs text-slate-500">
                  {t.userDisplayName ?? t.email} · {t.category} · {t.replyCount} repl{t.replyCount === 1 ? 'y' : 'ies'} ·{' '}
                  {new Date(t.updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={t.status} />
                <Link href={`/dashboard/support/${t.id}`} className="rounded-lg bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-700">
                  View
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
