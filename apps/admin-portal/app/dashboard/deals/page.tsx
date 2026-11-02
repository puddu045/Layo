'use client';

import { useEffect, useState } from 'react';
import type { Business, Deal, DealEngagementStats, DealStatus } from '@layo/contracts';
import { api } from '../../../lib/api-client';
import { StatusBadge } from '../../../components/StatusBadge';
import { DealForm } from '../../../components/DealForm';

const FILTERS: Array<DealStatus | 'ALL'> = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'ALL'];

export default function DealsPage() {
  const [filter, setFilter] = useState<DealStatus | 'ALL'>('PENDING');
  const [airportFilter, setAirportFilter] = useState('');
  const [terminalFilter, setTerminalFilter] = useState('');
  const [deals, setDeals] = useState<Deal[] | undefined>();
  const [stats, setStats] = useState<DealEngagementStats | undefined>();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [rejecting, setRejecting] = useState<string | undefined>();
  const [reason, setReason] = useState('');
  const [editing, setEditing] = useState<Deal | 'new' | undefined>();
  const [newDealBusinessId, setNewDealBusinessId] = useState('');

  const refresh = () => {
    const params = new URLSearchParams();
    if (filter !== 'ALL') params.set('status', filter);
    if (airportFilter.trim()) params.set('airportIata', airportFilter.trim().toUpperCase());
    if (terminalFilter.trim()) params.set('terminal', terminalFilter.trim());
    api.get<Deal[]>(`/deals?${params.toString()}`).then(setDeals);
  };

  useEffect(refresh, [filter, airportFilter, terminalFilter]);
  useEffect(() => {
    api.get<DealEngagementStats>('/deals/engagement-stats').then(setStats);
    api.get<Business[]>('/businesses?status=APPROVED').then(setBusinesses);
  }, []);

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

  const onDelete = async (deal: Deal) => {
    if (!window.confirm(`Delete "${deal.title}"? This cannot be undone.`)) return;
    await api.delete(`/deals/${deal.id}`);
    refresh();
  };

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-navy-900">Deals</h2>
      <p className="mb-4 text-sm text-slate-500">Full CRUD, approval workflow, scheduling, and engagement at a glance.</p>

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total deals" value={stats.totalDeals} />
          <StatCard label="Active now" value={stats.activeNow} />
          <StatCard label="Expiring within 7 days" value={stats.expiringWithin7Days} />
          <StatCard label="Top airport" value={stats.byAirport[0] ? `${stats.byAirport[0].airportIata} (${stats.byAirport[0].count})` : '—'} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
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
        <input value={airportFilter} onChange={(e) => setAirportFilter(e.target.value)} placeholder="Airport IATA" maxLength={3} className="input w-32" />
        <input value={terminalFilter} onChange={(e) => setTerminalFilter(e.target.value)} placeholder="Terminal" className="input w-28" />

        {editing === undefined && (
          <div className="ml-auto flex items-center gap-2">
            <select value={newDealBusinessId} onChange={(e) => setNewDealBusinessId(e.target.value)} className="input w-56">
              <option value="">Select a business…</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.airportIata})
                </option>
              ))}
            </select>
            <button
              disabled={!newDealBusinessId}
              onClick={() => setEditing('new')}
              className="rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              New deal
            </button>
          </div>
        )}
      </div>

      {editing !== undefined && (
        <div className="mb-4">
          <DealForm
            businessId={editing === 'new' ? newDealBusinessId : editing.businessId}
            defaultAirportIata={businesses.find((b) => b.id === newDealBusinessId)?.airportIata ?? ''}
            deal={editing === 'new' ? undefined : editing}
            onSaved={() => {
              setEditing(undefined);
              setNewDealBusinessId('');
              refresh();
            }}
            onCancel={() => setEditing(undefined)}
          />
        </div>
      )}

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

              <div className="mt-3 flex items-center gap-3">
                {deal.status === 'PENDING' && (
                  <>
                    <button onClick={() => approve(deal.id)} className="rounded-lg bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-700">
                      Approve
                    </button>
                    <button onClick={() => setRejecting(deal.id)} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">
                      Reject
                    </button>
                  </>
                )}
                <button onClick={() => setEditing(deal)} className="text-xs font-semibold text-navy-700 hover:underline">
                  Edit
                </button>
                <button onClick={() => onDelete(deal)} className="text-xs font-semibold text-red-600 hover:underline">
                  Delete
                </button>
              </div>

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

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-navy-900">{value}</p>
    </div>
  );
}
