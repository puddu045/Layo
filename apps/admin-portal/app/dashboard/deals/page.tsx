'use client';

import { useEffect, useState } from 'react';
import type { Deal, DealStatus } from '@layo/contracts';
import { api } from '../../../lib/api-client';
import { StatusBadge } from '../../../components/StatusBadge';

const FILTERS: Array<DealStatus | 'ALL'> = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'ALL'];

export default function DealsPage() {
  const [filter, setFilter] = useState<DealStatus | 'ALL'>('PENDING');
  const [deals, setDeals] = useState<Deal[] | undefined>();
  const [rejecting, setRejecting] = useState<string | undefined>();
  const [reason, setReason] = useState('');

  const refresh = () => {
    const query = filter === 'ALL' ? '' : `?status=${filter}`;
    api.get<Deal[]>(`/deals${query}`).then(setDeals);
  };

  useEffect(refresh, [filter]);

  const approve = async (id: string) => {
    await api.patch(`/deals/${id}/moderate`, { approve: true });
    refresh();
  };

  const confirmReject = async (id: string) => {
    await api.patch(`/deals/${id}/moderate`, { approve: false, rejectionReason: reason || undefined });
    setRejecting(undefined);
    setReason('');
    refresh();
  };

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-navy-900">Deals</h2>
      <p className="mb-4 text-sm text-slate-500">Review deals submitted by approved businesses.</p>

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

      {deals === undefined ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : deals.length === 0 ? (
        <p className="text-sm text-slate-400">No deals here.</p>
      ) : (
        <ul className="space-y-2">
          {deals.map((deal) => (
            <li key={deal.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-navy-900">{deal.title}</p>
                  <p className="text-xs text-slate-500">
                    {deal.businessName} · {deal.airportIata}
                    {deal.terminal ? ` · Terminal ${deal.terminal}` : ''} · {deal.validFrom} → {deal.validUntil}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{deal.description}</p>
                </div>
                <StatusBadge status={deal.status} />
              </div>

              {deal.status === 'PENDING' && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => approve(deal.id)}
                    className="rounded-lg bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setRejecting(deal.id)}
                    className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700"
                  >
                    Reject
                  </button>
                </div>
              )}

              {rejecting === deal.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="input flex-1"
                  />
                  <button
                    onClick={() => confirmReject(deal.id)}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Confirm reject
                  </button>
                  <button
                    onClick={() => {
                      setRejecting(undefined);
                      setReason('');
                    }}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-slate-600"
                  >
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
