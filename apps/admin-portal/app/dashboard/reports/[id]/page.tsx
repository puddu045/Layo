'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { AdminAccount, AdminReportDetail } from '@layo/contracts';
import { api } from '../../../../lib/api-client';
import { StatusBadge } from '../../../../components/StatusBadge';

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-500',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-700',
};

const REASON_LABELS: Record<string, string> = {
  HARASSMENT: 'Abusive language or harassment',
  SPAM: 'Spam or marketing',
  INAPPROPRIATE_CONTENT: 'Inappropriate content',
  IMPERSONATION: 'Impersonation',
  SAFETY_CONCERN: 'Safety concern',
  OTHER: 'Something else',
};

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<AdminReportDetail | undefined>();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [acting, setActing] = useState(false);

  const refresh = () => {
    api.get<AdminReportDetail>(`/reports/${id}`).then(setReport);
  };

  useEffect(refresh, [id]);
  useEffect(() => {
    api.get<AdminAccount[]>('/admin-accounts').then(setAdmins);
  }, []);

  const assign = async (adminId: string | null) => {
    setActing(true);
    try {
      await api.patch(`/reports/${id}/assign`, { adminId });
      refresh();
    } finally {
      setActing(false);
    }
  };

  const act = async (action: 'dismiss' | 'review' | 'ban') => {
    if (action === 'ban' && !window.confirm('Ban this user? Their account will be suspended immediately.')) {
      return;
    }
    setActing(true);
    try {
      await api.patch(`/reports/${id}/${action}`);
      refresh();
    } finally {
      setActing(false);
    }
  };

  if (!report) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div>
      <button onClick={() => router.push('/dashboard/reports')} className="mb-4 text-sm text-slate-500 hover:text-navy-900">
        ← Back to reports
      </button>

      <div className="mb-6 flex items-start justify-between rounded-lg border border-border bg-surface p-5">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-lg font-bold text-navy-900">{REASON_LABELS[report.reason] ?? report.reason}</h2>
            <StatusBadge status={report.status} />
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_COLORS[report.priority]}`}>
              {report.priority}
            </span>
          </div>
          <p className="text-sm text-slate-600">
            Reported by <strong>{report.reporter.displayName ?? report.reporter.email}</strong> ({report.reporter.email})
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span>Assigned to:</span>
            <select
              value={report.assignedAdminId ?? ''}
              onChange={(e) => assign(e.target.value || null)}
              disabled={acting}
              className="rounded border border-border bg-background px-2 py-1"
            >
              <option value="">Unassigned</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email}
                </option>
              ))}
            </select>
          </div>
          {report.reportedUser && (
            <p className="text-sm text-slate-600">
              Against <strong>{report.reportedUser.displayName ?? report.reportedUser.email}</strong> (
              {report.reportedUser.email})
              {typeof report.reportedUserTotalReporterCount === 'number' && (
                <span className="ml-2 text-xs text-slate-400">
                  · reported by {report.reportedUserTotalReporterCount} distinct{' '}
                  {report.reportedUserTotalReporterCount === 1 ? 'person' : 'people'} in total
                </span>
              )}
            </p>
          )}
          {report.details && <p className="mt-2 text-sm text-slate-700">&ldquo;{report.details}&rdquo;</p>}
          <p className="mt-2 text-xs text-slate-400">Filed {new Date(report.createdAt).toLocaleString()}</p>
        </div>

        <div className="flex shrink-0 gap-2">
          <ActionButton label="Dismiss" onClick={() => act('dismiss')} disabled={acting} />
          <ActionButton label="Mark reviewed" onClick={() => act('review')} disabled={acting} />
          {report.reportedUser && (
            <ActionButton label="Ban user" danger onClick={() => act('ban')} disabled={acting} />
          )}
        </div>
      </div>

      <h3 className="mb-2 text-sm font-semibold text-navy-900">Conversation</h3>
      <p className="mb-3 text-xs text-slate-400">
        The reported conversation, shown for review purposes — every view of this is logged.
      </p>
      {report.conversation.length === 0 ? (
        <p className="text-sm text-slate-400">No conversation to show for this report.</p>
      ) : (
        <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
          {report.conversation.map((m) => (
            <div key={m.id} className="text-sm">
              <span className="font-semibold text-navy-900">{m.senderDisplayName}</span>{' '}
              <span className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleString()}</span>
              <p className="text-slate-700">{m.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
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
