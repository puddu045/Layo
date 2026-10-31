'use client';

import { useEffect, useState } from 'react';
import type { Business, Deal } from '@layo/contracts';
import { api } from '../../lib/api-client';

export default function DashboardHome() {
  const [pendingDeals, setPendingDeals] = useState<number | undefined>();
  const [pendingBusinesses, setPendingBusinesses] = useState<number | undefined>();

  useEffect(() => {
    api.get<Deal[]>('/deals?status=PENDING').then((rows) => setPendingDeals(rows.length));
    api.get<Business[]>('/businesses?status=PENDING').then((rows) => setPendingBusinesses(rows.length));
  }, []);

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-navy-900">Overview</h2>
      <p className="mb-8 text-sm text-slate-500">
        Review and approve business registrations and the deals they submit.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Pending deals" value={pendingDeals} />
        <StatCard label="Pending businesses" value={pendingBusinesses} />
        <StatCard label="Open reports" value={undefined} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-navy-900">{value ?? '—'}</p>
    </div>
  );
}
