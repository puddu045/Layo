'use client';

import { useEffect, useState } from 'react';
import type { Deal } from '@layo/contracts';
import { api } from '../lib/api-client';
import { StatusBadge } from './StatusBadge';
import { DealForm } from './DealForm';

export function BusinessDeals({ businessId, airportIata }: { businessId: string; airportIata: string }) {
  const [deals, setDeals] = useState<Deal[] | undefined>();
  const [editing, setEditing] = useState<Deal | 'new' | undefined>();

  const refresh = () => {
    api.get<Deal[]>(`/deals/business/${businessId}`).then(setDeals);
  };

  useEffect(refresh, [businessId]);

  const onDelete = async (deal: Deal) => {
    if (!window.confirm(`Delete "${deal.title}"? This cannot be undone.`)) return;
    await api.delete(`/deals/${deal.id}`);
    refresh();
  };

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-navy-900">Deals</h3>
        {editing === undefined && (
          <button
            onClick={() => setEditing('new')}
            className="rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white"
          >
            New deal
          </button>
        )}
      </div>

      {editing !== undefined && (
        <div className="mb-3">
          <DealForm
            businessId={businessId}
            defaultAirportIata={airportIata}
            deal={editing === 'new' ? undefined : editing}
            onSaved={() => {
              setEditing(undefined);
              refresh();
            }}
            onCancel={() => setEditing(undefined)}
          />
        </div>
      )}

      {deals === undefined ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : deals.length === 0 ? (
        <p className="text-sm text-slate-400">No deals yet.</p>
      ) : (
        <ul className="space-y-2">
          {deals.map((deal) => (
            <li key={deal.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-navy-900">{deal.title}</p>
                  <p className="text-xs text-slate-500">
                    {deal.airportIata}
                    {deal.terminal ? ` · Terminal ${deal.terminal}` : ''} · {deal.validFrom} → {deal.validUntil}
                  </p>
                  {deal.status === 'REJECTED' && (
                    <p className="mt-1 text-xs text-red-600">
                      Rejected{deal.rejectionReason ? `: ${deal.rejectionReason}` : ''} — edit and resubmit.
                    </p>
                  )}
                </div>
                <StatusBadge status={deal.status} />
              </div>
              <div className="mt-2 flex gap-3">
                <button onClick={() => setEditing(deal)} className="text-xs font-semibold text-navy-700 hover:underline">
                  Edit
                </button>
                <button onClick={() => onDelete(deal)} className="text-xs font-semibold text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
