'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AdminReportListItem, ReportStatus } from '@layo/contracts';
import { api } from '../../../lib/api-client';
import { StatusBadge } from '../../../components/StatusBadge';

const REASON_LABELS: Record<string, string> = {
  HARASSMENT: 'Abusive language or harassment',
  SPAM: 'Spam or marketing',
  INAPPROPRIATE_CONTENT: 'Inappropriate content',
  IMPERSONATION: 'Impersonation',
  SAFETY_CONCERN: 'Safety concern',
  OTHER: 'Something else',
};

const FILTERS: Array<ReportStatus | 'ALL'> = ['OPEN', 'REVIEWED', 'ACTIONED', 'DISMISSED', 'ALL'];

export default function ReportsPage() {
  const [filter, setFilter] = useState<ReportStatus | 'ALL'>('OPEN');
  const [reports, setReports] = useState<AdminReportListItem[] | undefined>();

  useEffect(() => {
    const query = filter === 'ALL' ? '' : `?status=${filter}`;
    api.get<AdminReportListItem[]>(`/reports${query}`).then(setReports);
  }, [filter]);

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-navy-900">Reports & moderation</h2>
      <p className="mb-4 text-sm text-slate-500">
        Reports filed when a traveller blocks or reports someone, with escalation already applied automatically at
        3 and 10 distinct reporters.
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

      {reports === undefined ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-slate-400">No reports here.</p>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
              <div>
                <p className="text-sm font-semibold text-navy-900">{REASON_LABELS[r.reason] ?? r.reason}</p>
                <p className="text-xs text-slate-500">
                  {r.reporter.displayName ?? r.reporter.email} reported{' '}
                  {r.reportedUser ? r.reportedUser.displayName ?? r.reportedUser.email : 'a message'} ·{' '}
                  {new Date(r.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={r.status} />
                <Link
                  href={`/dashboard/reports/${r.id}`}
                  className="rounded-lg bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-700"
                >
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
