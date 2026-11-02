'use client';

import { useEffect, useState } from 'react';
import type { Announcement, AnnouncementAudience } from '@layo/contracts';
import { api, ApiError } from '../../../lib/api-client';
import { StatusBadge } from '../../../components/StatusBadge';

export default function NotificationsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[] | undefined>();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<AnnouncementAudience>('ALL');
  const [targetAirportIata, setTargetAirportIata] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [sending, setSending] = useState(false);

  const refresh = () => {
    api.get<Announcement[]>('/announcements').then(setAnnouncements);
  };

  useEffect(refresh, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setSending(true);
    try {
      await api.post('/announcements', {
        title,
        body,
        audience,
        targetAirportIata: audience === 'BY_AIRPORT' ? targetAirportIata.toUpperCase() : undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      setTitle('');
      setBody('');
      setTargetAirportIata('');
      setScheduledAt('');
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send announcement');
    } finally {
      setSending(false);
    }
  };

  const cancel = async (id: string) => {
    if (!window.confirm('Cancel this scheduled announcement?')) return;
    await api.delete(`/announcements/${id}`);
    refresh();
  };

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-navy-900">Notifications</h2>
      <p className="mb-4 text-sm text-slate-500">Create announcements for everyone, one airport&apos;s travellers, or specific people, now or scheduled.</p>

      <form onSubmit={send} className="mb-6 space-y-3 rounded-xl border border-border bg-surface p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="input" required />
          <select value={audience} onChange={(e) => setAudience(e.target.value as AnnouncementAudience)} className="input">
            <option value="ALL">All travellers</option>
            <option value="BY_AIRPORT">By airport</option>
          </select>
        </div>
        {audience === 'BY_AIRPORT' && (
          <input
            value={targetAirportIata}
            onChange={(e) => setTargetAirportIata(e.target.value)}
            placeholder="Airport IATA"
            maxLength={3}
            className="input w-40"
            required
          />
        )}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message" className="input min-h-20" required />
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500">Schedule for later (optional):</label>
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="input w-56" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={sending} className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {sending ? 'Sending…' : scheduledAt ? 'Schedule announcement' : 'Send now'}
        </button>
      </form>

      <h3 className="mb-2 text-sm font-semibold text-navy-900">History</h3>
      {announcements === undefined ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : announcements.length === 0 ? (
        <p className="text-sm text-slate-400">No announcements sent yet.</p>
      ) : (
        <ul className="space-y-2">
          {announcements.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4">
              <div>
                <p className="text-sm font-semibold text-navy-900">{a.title}</p>
                <p className="text-xs text-slate-500">
                  {a.audience === 'ALL' ? 'All travellers' : a.audience === 'BY_AIRPORT' ? `Airport ${a.targetAirportIata}` : `${a.targetUserIds.length} people`}
                  {' · '}
                  {a.sentAt ? `sent ${new Date(a.sentAt).toLocaleString()}` : a.scheduledAt ? `scheduled for ${new Date(a.scheduledAt).toLocaleString()}` : ''}
                </p>
                <p className="mt-1 text-sm text-slate-600">{a.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={a.status} />
                {a.status === 'SCHEDULED' && (
                  <button onClick={() => cancel(a.id)} className="text-xs font-semibold text-red-600 hover:underline">
                    Cancel
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
