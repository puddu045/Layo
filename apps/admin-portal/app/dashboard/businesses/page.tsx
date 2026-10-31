'use client';

import { useEffect, useState } from 'react';
import type { Business, BusinessStatus } from '@layo/contracts';
import { api } from '../../../lib/api-client';
import { StatusBadge } from '../../../components/StatusBadge';

const CATEGORY_LABELS: Record<string, string> = {
  FOOD_DRINK: 'Food & drink',
  DUTY_FREE: 'Duty free',
  LOUNGE: 'Lounge',
  FASHION_RETAIL: 'Fashion & retail',
  TRAVEL_ESSENTIALS: 'Travel essentials',
  SERVICES: 'Services',
};

const FILTERS: Array<BusinessStatus | 'ALL'> = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'ALL'];

export default function BusinessesPage() {
  const [filter, setFilter] = useState<BusinessStatus | 'ALL'>('PENDING');
  const [businesses, setBusinesses] = useState<Business[] | undefined>();

  const refresh = () => {
    const query = filter === 'ALL' ? '' : `?status=${filter}`;
    api.get<Business[]>(`/businesses${query}`).then(setBusinesses);
  };

  useEffect(refresh, [filter]);

  const act = async (id: string, action: 'approve' | 'reject' | 'suspend' | 'reinstate') => {
    await api.patch(`/businesses/${id}/${action}`);
    refresh();
  };

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-navy-900">Businesses</h2>
      <p className="mb-4 text-sm text-slate-500">Review self-registered businesses before they can submit deals.</p>

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

      {businesses === undefined ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : businesses.length === 0 ? (
        <p className="text-sm text-slate-400">No businesses here.</p>
      ) : (
        <ul className="space-y-2">
          {businesses.map((b) => (
            <li key={b.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
              <div>
                <p className="text-sm font-semibold text-navy-900">{b.name}</p>
                <p className="text-xs text-slate-500">
                  {CATEGORY_LABELS[b.category] ?? b.category} · {b.airportIata} · {b.contactEmail}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={b.status} />
                {b.status === 'PENDING' && (
                  <>
                    <ActionButton label="Approve" onClick={() => act(b.id, 'approve')} />
                    <ActionButton label="Reject" danger onClick={() => act(b.id, 'reject')} />
                  </>
                )}
                {b.status === 'APPROVED' && <ActionButton label="Suspend" danger onClick={() => act(b.id, 'suspend')} />}
                {b.status === 'SUSPENDED' && <ActionButton label="Reinstate" onClick={() => act(b.id, 'reinstate')} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActionButton({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
        danger ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'
      }`}
    >
      {label}
    </button>
  );
}
