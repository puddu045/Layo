'use client';

import { useEffect, useState, type PropsWithChildren } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabaseBrowser } from '../lib/supabase-browser';

/**
 * Client-side route guard for the (dashboard) group. Redirects to /login when
 * there's no Supabase session. This is a Phase 1 foundation — a production
 * build should also enforce admin/business authorization server-side on every
 * API call (the NestJS API already never trusts a client-supplied user id).
 */
export function AuthGate({ children }: PropsWithChildren) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session, router]);

  if (session === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (!session) return null;

  return <>{children}</>;
}
