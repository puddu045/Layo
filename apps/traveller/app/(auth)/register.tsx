import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { signUpRequestSchema } from '@layo/contracts';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/lib/auth-context';
import { colors, spacing, typography } from '../../src/theme/tokens';

export default function Register() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const onSubmit = async () => {
    setError(undefined);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const parsed = signUpRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid details');
      return;
    }
    setLoading(true);
    try {
      await signUp(parsed.data.email, parsed.data.password);
      setConfirmationSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  if (confirmationSent) {
    return (
      <ScreenContainer style={styles.container}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We&apos;ve sent a confirmation link to {email}. Confirm it, then sign in below.
        </Text>
        <Button label="Go to sign in" onPress={() => router.replace('/(auth)/login')} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.title}>Create your account</Text>
      <Text style={styles.subtitle}>You must be 18 or older to use Layo.</Text>

      <TextField
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField label="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <TextField label="Confirm password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Create account" onPress={onSubmit} loading={loading} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <Link href="/(auth)/login" style={styles.link}>
          Sign in
        </Link>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center' },
  title: { ...typography.display, color: colors.navy900, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg, gap: spacing.xs },
  footerText: { ...typography.body, color: colors.textSecondary },
  link: { ...typography.body, color: colors.teal500, fontWeight: '600' },
});
