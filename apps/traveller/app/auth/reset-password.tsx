import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { resetPasswordRequestSchema } from '@layo/contracts';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { ErrorState, LoadingState } from '../../src/components/StateViews';
import { useAuth } from '../../src/lib/auth-context';
import { supabase } from '../../src/lib/supabase';
import { notifyInfo } from '../../src/lib/notify';
import { colors, spacing, typography } from '../../src/theme/tokens';

interface ParsedResetUrl {
  accessToken?: string;
  refreshToken?: string;
  errorDescription?: string;
}

// Same fragment-based shape as `auth/confirm.tsx` — see that screen's comment for why it's
// parsed by hand instead of through `expo-linking`'s own query/path parser.
function parseResetUrl(url: string): ParsedResetUrl {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const params = new URLSearchParams(hash);
  return {
    accessToken: params.get('access_token') ?? undefined,
    refreshToken: params.get('refresh_token') ?? undefined,
    errorDescription: params.get('error_description') ?? undefined,
  };
}

/**
 * Landing screen for the `layo://auth/reset-password` deep link a "forgot password" email opens
 * on native (see `auth-context.tsx`'s `PASSWORD_RESET_REDIRECT`). Unlike `auth/confirm.tsx`, this
 * one deliberately *does* establish a session from the link's tokens — `supabase.auth.updateUser`
 * needs an authenticated session to change the password, and this link is Supabase's own
 * proof the request came from whoever owns the inbox. Once the new password is set, that session
 * is immediately discarded again — the user still signs in for themselves afterwards, same as
 * email confirmation.
 */
export default function ResetPassword() {
  const url = Linking.useURL();
  const { updatePassword, signOut } = useAuth();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!url) return;

    (async () => {
      const { accessToken, refreshToken, errorDescription } = parseResetUrl(url);
      if (errorDescription) {
        setError(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
        setStatus('error');
        return;
      }
      if (!accessToken || !refreshToken) {
        setError('This reset link is invalid.');
        setStatus('error');
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) {
        setError(sessionError.message);
        setStatus('error');
        return;
      }
      setStatus('ready');
    })();
  }, [url]);

  const onSubmit = async () => {
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const parsed = resetPasswordRequestSchema.safeParse({ password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid password');
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(parsed.data.password);
      await signOut();
      notifyInfo('Password updated', 'You can now sign in with your new password.');
      router.replace('/(auth)/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <ScreenContainer>
        <LoadingState label="Verifying your link…" />
      </ScreenContainer>
    );
  }

  if (status === 'error') {
    return (
      <ScreenContainer>
        <ErrorState
          message={error ?? 'This reset link is invalid or has expired.'}
          onRetry={() => router.replace('/(auth)/forgot-password')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.subtitle}>Choose a new password for your account.</Text>

        <TextField label="New password" secureTextEntry value={password} onChangeText={setPassword} />
        <TextField
          label="Confirm new password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Update password" onPress={onSubmit} loading={submitting} />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  title: { ...typography.display, color: colors.navy900, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
});
