import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ErrorState, LoadingState } from '../../src/components/StateViews';
import { notifyInfo } from '../../src/lib/notify';

// Supabase's confirmation redirect appends the result (a session, or an error) after a `#`, not
// as normal query params — same shape as its web implicit flow, just landing on this deep link
// instead of a browser. `expo-linking`'s own parser only looks at the path/query, so the
// fragment is pulled out and read manually here.
function parseConfirmUrl(url: string): { confirmed: boolean; errorDescription?: string } {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const params = new URLSearchParams(hash);
  return {
    // Supabase only ever puts an access_token here once it's actually verified the link —
    // that's all this screen needs it for, so the token itself is never used.
    confirmed: params.has('access_token'),
    errorDescription: params.get('error_description') ?? undefined,
  };
}

/**
 * Landing screen for the `layo://auth/confirm` deep link a signup confirmation email opens on
 * native (see `auth-context.tsx`'s `EMAIL_CONFIRM_REDIRECT`). `Linking.useURL()` — rather than
 * `getInitialURL()` alone — covers both a cold start (app wasn't running) and a warm one (app
 * already open in the background when the link is tapped).
 *
 * Deliberately doesn't sign the user in with the tokens Supabase hands back — confirming an
 * email is a one-time action, not an implicit login, so this always lands back on the login
 * screen and lets them sign in themselves.
 */
export default function ConfirmEmail() {
  const url = Linking.useURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;

    const { confirmed, errorDescription } = parseConfirmUrl(url);
    if (errorDescription) {
      setError(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
      return;
    }
    if (confirmed) {
      notifyInfo('Email confirmed', 'You can now sign in.');
    }
    router.replace('/(auth)/login');
  }, [url]);

  if (error) {
    return (
      <ScreenContainer>
        <ErrorState message={error} onRetry={() => router.replace('/(auth)/login')} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <LoadingState label="Confirming your email…" />
    </ScreenContainer>
  );
}
