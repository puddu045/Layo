'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Analytics } from '@layo/contracts';
import { api } from '../../../lib/api-client';

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | undefined>();

  useEffect(() => {
    api.get<Analytics>('/analytics').then(setData);
  }, []);

  if (data === undefined) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-navy-900">Analytics</h2>
      <p className="mb-6 text-sm text-slate-500">User growth, retention, popular airports, journey trends, matching success, chat activity, and deal performance.</p>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Retention (week over week)" value={`${Math.round(data.retentionRate * 100)}%`} />
        <StatCard label="Matching success (accepted / sent)" value={`${Math.round(data.matchingSuccessRate * 100)}%`} />
        <StatCard label="Top airport" value={data.popularAirports[0]?.airportIata ?? '—'} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="User growth (30 days)">
          <LineChart data={data.userGrowth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E3E8F0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#1D4E89" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Journey creation (30 days)">
          <LineChart data={data.journeyTrends}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E3E8F0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#1FA2A6" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Chat activity — 1:1 + airport rooms (30 days)">
          <BarChart data={data.chatActivity}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E3E8F0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#13335C" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Deal performance by status">
          <BarChart data={data.dealPerformance} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#E3E8F0" />
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis dataKey="status" type="category" tick={{ fontSize: 11 }} width={80} />
            <Tooltip />
            <Bar dataKey="count" fill="#1FA2A6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold text-navy-900">Popular airports</h3>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {data.popularAirports.map((a) => (
            <li key={a.airportIata} className="rounded-lg border border-border bg-background p-3 text-center">
              <p className="text-lg font-bold text-navy-900">{a.airportIata}</p>
              <p className="text-xs text-slate-500">{a.count} members</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-navy-900">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-3 text-sm font-semibold text-navy-900">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}
