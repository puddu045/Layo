import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { updateProfileRequestSchema } from '@layo/contracts';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { ErrorState, LoadingState } from '../src/components/StateViews';
import { useAuth } from '../src/lib/auth-context';
import { useOwnProfile, useUpdateProfile } from '../src/hooks/api-hooks';
import { colors, spacing, typography } from '../src/theme/tokens';

export default function Settings() {
  const { signOut } = useAuth();
  const profile = useOwnProfile();
  const updateProfile = useUpdateProfile();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  const [languages, setLanguages] = useState('');
  const [discoverable, setDiscoverable] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile.data) {
      setDisplayName(profile.data.displayName);
      setBio(profile.data.bio);
      setInterests(profile.data.interests.join(', '));
      setLanguages(profile.data.languages.join(', '));
      setDiscoverable(profile.data.discoverable);
    }
  }, [profile.data]);

  if (profile.isLoading) {
    return (
      <ScreenContainer>
        <LoadingState label="Loading settings…" />
      </ScreenContainer>
    );
  }

  if (profile.isError) {
    return (
      <ScreenContainer>
        <ErrorState message="Could not load your profile" onRetry={() => profile.refetch()} />
      </ScreenContainer>
    );
  }

  const onSave = async () => {
    setError(undefined);
    setSaved(false);
    const parsed = updateProfileRequestSchema.safeParse({
      displayName,
      bio,
      interests: interests.split(',').map((s) => s.trim()).filter(Boolean),
      languages: languages.split(',').map((s) => s.trim()).filter(Boolean),
      discoverable,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form for errors');
      return;
    }
    try {
      await updateProfile.mutateAsync(parsed.data);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes');
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <TextField label="Display name" value={displayName} onChangeText={setDisplayName} />
        <TextField
          label="Bio"
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />
        <TextField label="Interests (comma separated)" value={interests} onChangeText={setInterests} />
        <TextField label="Languages (comma separated)" value={languages} onChangeText={setLanguages} />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Discoverable to other travellers</Text>
            <Text style={styles.switchHint}>Turn this off to hide yourself from everyone's Discover tab.</Text>
          </View>
          <Switch value={discoverable} onValueChange={setDiscoverable} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {saved ? <Text style={styles.saved}>Saved!</Text> : null}

        <Button label="Save changes" onPress={onSave} loading={updateProfile.isPending} />

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Privacy & safety</Text>
        <Text style={styles.hint}>
          Blocking, reporting and account/data deletion will be manageable from here in an upcoming release. If you
          need help now, contact support.
        </Text>

        <View style={styles.divider} />

        <Button
          label="Sign out"
          variant="ghost"
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/welcome');
          }}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.lg, paddingBottom: spacing.xxl },
  sectionTitle: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  switchLabel: { ...typography.body, color: colors.textPrimary },
  switchHint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
  saved: { ...typography.caption, color: colors.success, marginBottom: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  hint: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
});
