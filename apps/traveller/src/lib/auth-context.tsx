import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { api } from './api-client';

interface AuthMeResponse {
  id: string;
  email: string;
  isAdmin: boolean;
  hasProfile: boolean;
}

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  hasProfile: boolean | null;
  // Set only when the last /auth/me call failed — distinct from hasProfile === null, which also
  // means "haven't checked yet". Without this, a down API (or any other fetch failure) looked
  // identical to "still loading" and the profile screen spun forever with no way to retry.
  profileError: string | null;
  refreshProfileStatus: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const refreshProfileStatus = async () => {
    try {
      const me = await api.get<AuthMeResponse>('/auth/me');
      setHasProfile(me.hasProfile);
      setProfileError(null);
    } catch (err) {
      // api-client already signs out on a 401 (see its comment) before this error reaches here,
      // so by this point a 401 is already on its way to becoming `!session` — this still sets a
      // message for the brief moment before that takes effect, which is harmless.
      setHasProfile(null);
      setProfileError(err instanceof Error ? err.message : 'Could not reach the server');
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      refreshProfileStatus();
    } else {
      setHasProfile(null);
      setProfileError(null);
    }
  }, [session?.user.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      hasProfile,
      profileError,
      refreshProfileStatus,
      signUp: async (email, password) => {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      },
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      resendConfirmation: async (email) => {
        const { error } = await supabase.auth.resend({ type: 'signup', email });
        if (error) throw error;
      },
    }),
    [session, loading, hasProfile, profileError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
