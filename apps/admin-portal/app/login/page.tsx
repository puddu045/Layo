'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInRequestSchema } from '@layo/contracts';
import { BRAND } from '@layo/config';
import { supabaseBrowser } from '../../lib/supabase-browser';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    const parsed = signInRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid details');
      return;
    }
    setLoading(true);
    const { error: signInError } = await supabaseBrowser.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace('/dashboard');
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-navy-900">{BRAND.name} Admin</h1>
        <p className="mb-6 text-sm text-slate-500">
          Sign in with an administrator or approved business account.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-semibold text-slate-500">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-semibold text-slate-500">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-navy-500 focus:outline-none"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-navy-900 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
