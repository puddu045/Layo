'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { SupportStatus, SupportTicketDetail } from '@layo/contracts';
import { api } from '../../../../lib/api-client';
import { StatusBadge } from '../../../../components/StatusBadge';

const STATUSES: SupportStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export default function SupportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<SupportTicketDetail | undefined>();
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const refresh = () => {
    api.get<SupportTicketDetail>(`/support/tickets/${id}`).then(setTicket);
  };

  useEffect(refresh, [id]);

  const setStatus = async (status: SupportStatus) => {
    await api.patch(`/support/tickets/${id}/status`, { status });
    refresh();
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api.post(`/support/tickets/${id}/replies`, { body: reply });
      setReply('');
      refresh();
    } finally {
      setSending(false);
    }
  };

  if (!ticket) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div>
      <button onClick={() => router.push('/dashboard/support')} className="mb-4 text-sm text-slate-500 hover:text-navy-900">
        ← Back to support
      </button>

      <div className="mb-6 rounded-lg border border-border bg-surface p-5">
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-lg font-bold text-navy-900">{ticket.subject}</h2>
          <StatusBadge status={ticket.status} />
        </div>
        <p className="text-sm text-slate-600">
          {ticket.userDisplayName ?? ticket.email} ({ticket.email}) · {ticket.category}
        </p>
        <p className="mt-2 text-sm text-slate-700">{ticket.body}</p>
        <p className="mt-2 text-xs text-slate-400">Filed {new Date(ticket.createdAt).toLocaleString()}</p>

        <div className="mt-4 flex gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                ticket.status === s ? 'bg-navy-900 text-white' : 'bg-surface text-slate-600 border border-border'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <h3 className="mb-2 text-sm font-semibold text-navy-900">Conversation</h3>
      <ul className="mb-4 space-y-2">
        {ticket.replies.map((r) => (
          <li
            key={r.id}
            className={`rounded-lg p-3 text-sm ${r.isAdmin ? 'bg-teal-50 text-navy-900' : 'border border-border bg-surface'}`}
          >
            <p className="mb-1 text-xs font-semibold text-slate-500">{r.authorLabel}</p>
            <p>{r.body}</p>
            <p className="mt-1 text-xs text-slate-400">{new Date(r.createdAt).toLocaleString()}</p>
          </li>
        ))}
      </ul>

      <form onSubmit={sendReply} className="flex gap-2">
        <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" className="input flex-1" />
        <button type="submit" disabled={sending || !reply.trim()} className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
