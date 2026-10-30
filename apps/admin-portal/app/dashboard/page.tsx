export default function DashboardHome() {
  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-navy-900">Overview</h2>
      <p className="mb-8 text-sm text-slate-500">
        This is a Phase 1 foundation: authentication and the protected layout are wired up. Deal approval, business
        onboarding and moderation tools land in Phase 4.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Pending deals" value="—" />
        <StatCard label="Pending businesses" value="—" />
        <StatCard label="Open reports" value="—" />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-navy-900">{value}</p>
    </div>
  );
}
