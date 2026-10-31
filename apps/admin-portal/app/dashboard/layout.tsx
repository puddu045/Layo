'use client';

import type { PropsWithChildren } from 'react';
import { useRouter } from 'next/navigation';
import { BRAND } from '@layo/config';
import { AuthGate } from '../../components/AuthGate';
import { BusinessPortal } from '../../components/BusinessPortal';
import { useCurrentUser } from '../../lib/use-current-user';
import { supabaseBrowser } from '../../lib/supabase-browser';

const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Deals', href: '/dashboard/deals' },
  { label: 'Businesses', href: '/dashboard/businesses' },
  { label: 'Reports', href: '/dashboard/reports' },
];

export default function DashboardLayout({ children }: PropsWithChildren) {
  const router = useRouter();
  const me = useCurrentUser();

  return (
    <AuthGate>
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-surface p-6 md:block">
          <h1 className="mb-8 text-lg font-bold text-navy-900">{BRAND.name} Admin</h1>
          {me?.isAdmin && (
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-teal-100 hover:text-navy-900"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          )}
          <button
            onClick={async () => {
              await supabaseBrowser.auth.signOut();
              router.replace('/login');
            }}
            className="mt-8 block rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            Sign out
          </button>
        </aside>
        {/* A business owner gets the business portal regardless of which /dashboard/* route they're
            on — the admin-only nested pages are never rendered for them. */}
        <main className="flex-1 p-6 md:p-10">
          {!me ? null : me.isAdmin ? children : <BusinessPortal />}
        </main>
      </div>
    </AuthGate>
  );
}
