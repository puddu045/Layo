import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../src/lib/supabase';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ErrorState, LoadingState } from '../../src/components/StateViews';

interface ParsedConfirmUrl {
  accessToken?: string;
  refreshToken?: string;
  errorDescription?: string;
}

// Supabase's confirmation redirect appends the session (or an error) after a `#`, not as normal
// query params — same shape as its web implicit flow, just landing on this deep link instead of
// a browser. `expo-linking`'s own parser only looks at the path/query, so the fragment is pulled
// out and read manually here.
function parseConfirmUrl(url: string): ParsedConfirmUrl {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const params = new URLSearchParams(hash);
  return {
    accessToken: params.get('access_token') ?? undefined,
    refreshToken: params.get('refresh_token') ?? undefined,
    errorDescription: params.get('error_description') ?? undefined,
  };
}

/**
 * Landing screen for the `layo://auth/confirm` deep link a signup confirmation email opens on
 * native (see `auth-context.tsx`'s `EMAIL_CONFIRM_REDIRECT`). `Linking.useURL()` — rather than
 * `getInitialURL()` alone — covers both a cold start (app wasn't running) and a warm one (app
 * already open in the background when the link is tapped).
 */
export default function ConfirmEmail() {
  const url = Linking.useURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;

    (async () => {
      const { accessToken, refreshToken, errorDescription } = parseConfirmUrl(url);

      if (errorDescription) {
        setError(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
        return;
      }
      if (!accessToken || !refreshToken) {
        router.replace('/');
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      router.replace('/');
    })();
  }, [url]);

  if (error) {
    return (
      <ScreenContainer>
        <ErrorState message={error} onRetry={() => router.replace('/(auth)/welcome')} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <LoadingState label="Confirming your email…" />
    </ScreenContainer>
  );
}
