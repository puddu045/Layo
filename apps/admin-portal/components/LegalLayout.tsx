import type { PropsWithChildren } from 'react';
import { BRAND } from '@layo/config';

/**
 * Shared chrome for the public legal pages (/privacy, /terms) — deliberately outside
 * `/dashboard`, so it renders with no auth gate and no admin nav. Plain, readable prose
 * layout: these pages exist to be read and linked from app stores, not to match the
 * dashboard's own UI.
 */
export function LegalLayout({
  title,
  lastUpdated,
  children,
}: PropsWithChildren<{ title: string; lastUpdated: string }>) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <a href="/" className="text-sm text-navy-500 hover:underline">
        {BRAND.name}
      </a>
      <h1 className="mt-4 text-3xl font-bold text-navy-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">Last updated {lastUpdated}</p>
      <div className="legal-prose mt-8">{children}</div>
    </main>
  );
}
