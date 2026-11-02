'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { AdminRoomMessage, AdminRoomMute } from '@layo/contracts';
import { api } from '../../../../lib/api-client';

export default function AirportChatDetailPage() {
  const { iata } = useParams<{ iata: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<AdminRoomMessage[] | undefined>();
  const [mutes, setMutes] = useState<AdminRoomMute[]>([]);
  const [locked, setLocked] = useState(false);
  const [muting, setMuting] = useState<string | undefined>(); // userId being muted
  const [muteMinutes, setMuteMinutes] = useState('60');
  const [muteReason, setMuteReason] = useState('');

  const refresh = () => {
    api.get<AdminRoomMessage[]>(`/airport-rooms/${iata}/admin/messages`).then(setMessages);
    api.get<AdminRoomMute[]>(`/airport-rooms/${iata}/admin/mutes`).then(setMutes);
    api.get<{ airportIata: string; locked: boolean }[]>('/airport-rooms/admin/all').then((rooms) => {
      setLocked(!!rooms.find((r) => r.airportIata === iata)?.locked);
    });
  };

  useEffect(refresh, [iata]);

  const removeMessage = async (messageId: string) => {
    if (!window.confirm('Remove this message? It will be hidden from the room but kept for audit history.')) return;
    await api.delete(`/airport-rooms/${iata}/admin/messages/${messageId}`);
    refresh();
  };

  const toggleLock = async () => {
    if (locked) {
      await api.patch(`/airport-rooms/${iata}/admin/unlock`);
    } else {
      const reason = window.prompt('Reason for locking this room (optional):') ?? undefined;
      await api.patch(`/airport-rooms/${iata}/admin/lock`, { reason });
    }
    refresh();
  };

  const confirmMute = async () => {
    if (!muting) return;
    await api.post(`/airport-rooms/${iata}/admin/mutes`, {
      userId: muting,
      durationMinutes: muteMinutes ? Number(muteMinutes) : undefined,
      reason: muteReason || undefined,
    });
    setMuting(undefined);
    setMuteReason('');
    refresh();
  };

  const unmute = async (userId: string) => {
    await api.delete(`/airport-rooms/${iata}/admin/mutes/${userId}`);
    refresh();
  };

  const isMuted = (userId: string) => mutes.some((m) => m.userId === userId);

  return (
    <div>
      <button onClick={() => router.push('/dashboard/airport-chats')} className="mb-4 text-sm text-slate-500 hover:text-navy-900">
        ← Back to airport chats
      </button>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-navy-900">{iata} Airport Chat</h2>
        <button
          onClick={toggleLock}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${locked ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'}`}
        >
          {locked ? 'Unlock room' : 'Lock room'}
        </button>
      </div>

      {mutes.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-surface p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Currently muted</p>
          <ul className="space-y-1">
            {mutes.map((m) => (
              <li key={m.userId} className="flex items-center justify-between text-sm">
                <span>
                  {m.displayName ?? m.userId} {m.mutedUntil ? `until ${new Date(m.mutedUntil).toLocaleString()}` : '(indefinite)'}
                </span>
                <button onClick={() => unmute(m.userId)} className="text-xs font-semibold text-teal-600 hover:underline">
                  Unmute
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3 className="mb-2 text-sm font-semibold text-navy-900">Messages</h3>
      {messages === undefined ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-slate-400">No messages in this room yet.</p>
      ) : (
        <ul className="space-y-2">
          {messages.map((m) => (
            <li key={m.id} className={`rounded-lg border p-3 ${m.removed ? 'border-border bg-slate-50 opacity-60' : 'border-border bg-surface'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-navy-900">
                    {m.senderDisplayName}
                    {m.removed && <span className="ml-2 text-xs font-bold uppercase text-slate-400">Removed</span>}
                  </p>
                  <p className="text-sm text-slate-700">{m.body}</p>
                  <p className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleString()}</p>
                </div>
                {!m.removed && (
                  <div className="flex shrink-0 gap-2">
                    {!isMuted(m.senderId) && (
                      <button onClick={() => setMuting(m.senderId)} className="text-xs font-semibold text-amber-600 hover:underline">
                        Mute sender
                      </button>
                    )}
                    <button onClick={() => removeMessage(m.id)} className="text-xs font-semibold text-red-600 hover:underline">
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {muting === m.senderId && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 p-2">
                  <input
                    type="number"
                    value={muteMinutes}
                    onChange={(e) => setMuteMinutes(e.target.value)}
                    placeholder="Minutes (blank = indefinite)"
                    className="input w-40"
                  />
                  <input value={muteReason} onChange={(e) => setMuteReason(e.target.value)} placeholder="Reason" className="input flex-1" />
                  <button onClick={confirmMute} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white">
                    Confirm mute
                  </button>
                  <button onClick={() => setMuting(undefined)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-slate-600">
                    Cancel
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
