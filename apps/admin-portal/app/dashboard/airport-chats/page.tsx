'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AdminAirportRoom } from '@layo/contracts';
import { api } from '../../../lib/api-client';

export default function AirportChatsPage() {
  const [rooms, setRooms] = useState<AdminAirportRoom[] | undefined>();

  useEffect(() => {
    api.get<AdminAirportRoom[]>('/airport-rooms/admin/all').then(setRooms);
  }, []);

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-navy-900">Airport Chats</h2>
      <p className="mb-4 text-sm text-slate-500">Rooms with current traffic. Open one to moderate messages, mute travellers, or lock the room.</p>

      {rooms === undefined ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : rooms.length === 0 ? (
        <p className="text-sm text-slate-400">No airport rooms exist yet.</p>
      ) : (
        <ul className="space-y-2">
          {rooms.map((r) => (
            <li key={r.airportIata} className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
              <div>
                <p className="text-sm font-semibold text-navy-900">
                  {r.name}
                  {r.locked && <span className="ml-2 text-xs font-bold uppercase text-red-600">Locked</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {r.participantCount} participant{r.participantCount === 1 ? '' : 's'} · {r.messageCount} message
                  {r.messageCount === 1 ? '' : 's'}
                  {r.reportedMessageCount > 0 && (
                    <span className="ml-2 font-semibold text-red-600">{r.reportedMessageCount} reported</span>
                  )}
                </p>
              </div>
              <Link href={`/dashboard/airport-chats/${r.airportIata}`} className="rounded-lg bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-700">
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
