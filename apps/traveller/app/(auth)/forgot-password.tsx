import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { requestPasswordResetRequestSchema } from '@layo/contracts';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/lib/auth-context';
import { colors, spacing, typography } from '../../src/theme/tokens';

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    setError(undefined);
    const parsed = requestPasswordResetRequestSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid email');
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(parsed.data.email);
      // Supabase never reveals whether an email has an account (to prevent someone probing for
      // registered addresses), so this screen shows the same message either way.
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <ScreenContainer style={styles.container}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          If an account exists for {email}, we&apos;ve sent a link to reset your password.
        </Text>
        <Button label="Back to sign in" onPress={() => router.replace('/(auth)/login')} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* 'height' on Android, not undefined: see journeys/new.tsx for why. */}
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.subtitle}>Enter your email and we&apos;ll send you a link to reset it.</Text>

        <TextField
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Send reset link" onPress={onSubmit} loading={loading} />

        <View style={styles.footer}>
          <Link href="/(auth)/login" style={styles.link}>
            Back to sign in
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
  link: { ...typography.body, color: colors.primary, fontWeight: '600' },
});
