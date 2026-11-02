'use client';

import { useEffect, useState } from 'react';
import type { Overview } from '@layo/contracts';
import { api } from '../../lib/api-client';

export default function DashboardHome() {
  const [overview, setOverview] = useState<Overview | undefined>();

  useEffect(() => {
    api.get<Overview>('/overview').then(setOverview);
  }, []);

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-navy-900">Overview</h2>
      <p className="mb-6 text-sm text-slate-500">Live KPIs across users, journeys, chats, reports, and marketplace activity.</p>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total users" value={overview?.totalUsers} />
        <StatCard label="New users (30d)" value={overview?.newUsersLast30Days} />
        <StatCard label="Active journeys" value={overview?.activeJourneys} />
        <StatCard label="Connections" value={overview?.totalConnections} sub={overview ? `${overview.acceptedConnections} accepted` : undefined} />
        <StatCard
          label="Open reports"
          value={overview?.pendingReports}
          highlight={!!overview?.criticalReports}
          sub={overview?.criticalReports ? `${overview.criticalReports} critical` : undefined}
        />
        <StatCard label="Pending businesses" value={overview?.pendingBusinesses} />
        <StatCard label="Pending deals" value={overview?.pendingDeals} />
        <StatCard label="Open support tickets" value={overview?.openSupportTickets} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-3 text-sm font-semibold text-navy-900">Top airports by room activity</h3>
          {overview === undefined ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : overview.topAirports.length === 0 ? (
            <p className="text-sm text-slate-400">No airport room activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {overview.topAirports.map((a) => (
                <li key={a.airportIata} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-navy-900">{a.airportIata}</span>
                  <span className="text-slate-500">{a.activity} participants</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-3 text-sm font-semibold text-navy-900">Recent activity</h3>
          {overview === undefined ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : overview.recentActivity.length === 0 ? (
            <p className="text-sm text-slate-400">No recent admin activity.</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {overview.recentActivity.map((entry) => (
                <li key={entry.id} className="text-sm">
                  <span className="font-medium text-navy-900">{entry.actorEmail ?? 'System'}</span>{' '}
                  <span className="text-slate-500">
                    {entry.action.toLowerCase()} {entry.targetType.toLowerCase()}
                  </span>{' '}
                  <span className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: number | undefined;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${highlight ? 'border-red-300 bg-red-50' : 'border-border bg-surface'}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${highlight ? 'text-red-700' : 'text-navy-900'}`}>{value ?? '—'}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
