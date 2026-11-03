import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { signInRequestSchema } from '@layo/contracts';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/lib/auth-context';
import { notifyInfo } from '../../src/lib/notify';
import { colors, spacing, typography } from '../../src/theme/tokens';

export default function Login() {
  const { signIn, resendConfirmation } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  // Supabase rejects sign-in with this exact message when the account exists but hasn't clicked
  // the confirmation link yet — distinct from a wrong password, so it gets its own resend action
  // instead of just a generic error string.
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resending, setResending] = useState(false);

  const onSubmit = async () => {
    setError(undefined);
    setUnconfirmed(false);
    const parsed = signInRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid details');
      return;
    }
    setLoading(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
      router.replace('/');
    } catch (err) {
      if (err instanceof Error && /email not confirmed/i.test(err.message)) {
        setUnconfirmed(true);
        setError('Confirm your email before signing in — check your inbox for the link.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setResending(true);
    try {
      await resendConfirmation(email);
      notifyInfo('Email sent', `We've sent another confirmation link to ${email}.`);
    } catch (err) {
      notifyInfo('Could not resend', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <ScreenContainer>
      {/* 'height' on Android, not undefined: see journeys/new.tsx for why. */}
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue to your journeys.</Text>

        <TextField
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextField label="Password" secureTextEntry value={password} onChangeText={setPassword} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {unconfirmed && (
          <View style={{ marginBottom: spacing.md }}>
            <Button label="Resend confirmation email" variant="ghost" onPress={onResend} loading={resending} />
          </View>
        )}

        <Button label="Sign in" onPress={onSubmit} loading={loading} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don&apos;t have an account?</Text>
          <Link href="/(auth)/register" style={styles.link}>
            Create one
          </Link>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  title: { ...typography.display, color: colors.navy900, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg, gap: spacing.xs },
  footerText: { ...typography.body, color: colors.textSecondary },
  link: { ...typography.body, color: colors.primary, fontWeight: '600' },
});
