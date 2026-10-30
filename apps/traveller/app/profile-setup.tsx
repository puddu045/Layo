import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { createProfileRequestSchema } from '@layo/contracts';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { useAuth } from '../src/lib/auth-context';
import { useCreateProfile } from '../src/hooks/api-hooks';
import { colors, spacing, typography } from '../src/theme/tokens';

export default function ProfileSetup() {
  const { refreshProfileStatus } = useAuth();
  const createProfile = useCreateProfile();

  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  const [languages, setLanguages] = useState('');
  const [homeCityIata, setHomeCityIata] = useState('');
  const [discoverable, setDiscoverable] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const onSubmit = async () => {
    setError(undefined);
    const parsed = createProfileRequestSchema.safeParse({
      displayName,
      dateOfBirth,
      bio,
      interests: interests.split(',').map((s) => s.trim()).filter(Boolean),
      languages: languages.split(',').map((s) => s.trim()).filter(Boolean),
      homeCityIata: homeCityIata.trim() || undefined,
      discoverable,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form for errors');
      return;
    }

    try {
      await createProfile.mutateAsync(parsed.data);
      await refreshProfileStatus();
      router.replace('/(tabs)/discover');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile');
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>
          Tell other travellers a bit about yourself. Your date of birth is private — only your age is ever shown.
        </Text>

        <TextField label="Display name" value={displayName} onChangeText={setDisplayName} />
        <TextField
          label="Date of birth (YYYY-MM-DD)"
          placeholder="1995-06-15"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label="Bio"
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />
        <TextField
          label="Interests (comma separated)"
          placeholder="photography, street food, hiking"
          value={interests}
          onChangeText={setInterests}
        />
        <TextField
          label="Languages (comma separated)"
          placeholder="English, Hindi"
          value={languages}
          onChangeText={setLanguages}
        />
        <TextField
          label="Home city airport code (optional)"
          placeholder="LHR"
          autoCapitalize="characters"
          maxLength={3}
          value={homeCityIata}
          onChangeText={setHomeCityIata}
        />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Discoverable to other travellers</Text>
            <Text style={styles.switchHint}>
              You can turn this off any time in Settings. You won&apos;t appear in anyone&apos;s Discover tab while
              it&apos;s off.
            </Text>
          </View>
          <Switch value={discoverable} onValueChange={setDiscoverable} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Finish setup" onPress={onSubmit} loading={createProfile.isPending} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.lg, paddingBottom: spacing.xxl },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  switchLabel: { ...typography.subtitle, color: colors.textPrimary },
  switchHint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
});
