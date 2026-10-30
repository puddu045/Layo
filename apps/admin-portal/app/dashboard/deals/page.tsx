export default function DealsPage() {
  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-navy-900">Deals</h2>
      <p className="text-sm text-slate-500">
        Deal submission and approval workflows arrive in Phase 4. The data model (businesses, deals, categories,
        validity windows, approval status) is already defined in <code>packages/db/prisma/schema.prisma</code>.
      </p>
    </div>
  );
}
