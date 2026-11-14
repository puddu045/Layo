import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { updatePhoneRequestSchema, updateProfileRequestSchema } from '@layo/contracts';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { Avatar } from '../src/components/Avatar';
import { AvatarCropModal } from '../src/components/AvatarCropModal';
import { ImageViewerModal } from '../src/components/ImageViewerModal';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { ErrorState, LoadingState } from '../src/components/StateViews';
import { useAuth } from '../src/lib/auth-context';
import { useDeleteAccount, useOwnProfile, useUpdatePhone, useUpdateProfile } from '../src/hooks/api-hooks';
import { useUploadAvatar } from '../src/hooks/avatar-hooks';
import { notifyConfirm, notifyInfo } from '../src/lib/notify';
import { ApiError } from '../src/lib/api-client';
import { colors, radius, spacing, typography } from '../src/theme/tokens';

export default function Settings() {
  const { signOut, session } = useAuth();
  const profile = useOwnProfile();
  const updateProfile = useUpdateProfile();
  const updatePhone = useUpdatePhone();
  const deleteAccount = useDeleteAccount();
  const uploadAvatar = useUploadAvatar();
  const [deleting, setDeleting] = useState(false);
  const [pickedPhotoUri, setPickedPhotoUri] = useState<string | undefined>();
  const [viewerOpen, setViewerOpen] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  const [languages, setLanguages] = useState('');
  const [discoverable, setDiscoverable] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [phoneSaved, setPhoneSaved] = useState(false);

  useEffect(() => {
    if (profile.data) {
      setDisplayName(profile.data.displayName);
      setBio(profile.data.bio);
      setInterests(profile.data.interests.join(', '));
      setLanguages(profile.data.languages.join(', '));
      setDiscoverable(profile.data.discoverable);
      setPhone(profile.data.phone ?? '');
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

  const onSavePhone = async () => {
    setPhoneError(undefined);
    setPhoneSaved(false);
    const parsed = updatePhoneRequestSchema.safeParse({ phone: phone.trim() || null });
    if (!parsed.success) {
      setPhoneError(parsed.error.issues[0]?.message ?? 'Enter a valid phone number');
      return;
    }
    try {
      await updatePhone.mutateAsync(parsed.data);
      setPhoneSaved(true);
    } catch (err) {
      setPhoneError(err instanceof ApiError ? err.message : 'Could not save your phone number');
    }
  };

  const onPickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notifyInfo('Permission needed', 'Photo library access is needed to choose a profile picture.');
      return;
    }
    // No allowsEditing/aspect here — AvatarCropModal is this app's own crop step, shown next;
    // the OS cropper and ours stacked back-to-back would just be a confusing double crop.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    setPickedPhotoUri(result.assets[0].uri);
  };

  const onCropConfirmed = (croppedUri: string) => {
    setPickedPhotoUri(undefined);
    uploadAvatar.mutate(croppedUri, {
      onError: (err) =>
        notifyInfo('Could not update photo', err instanceof Error ? err.message : 'Please try again.'),
    });
  };

  const onDeleteAccount = () => {
    notifyConfirm(
      'Delete your account',
      'This signs you out permanently and removes your access to Layo. This cannot be undone from the app — contact support to restore it.',
      async () => {
        setDeleting(true);
        try {
          await deleteAccount.mutateAsync();
          await signOut();
          router.replace('/(auth)/welcome');
        } catch (err) {
          notifyInfo('Error', err instanceof Error ? err.message : 'Could not delete your account');
        } finally {
          setDeleting(false);
        }
      },
      { confirmLabel: 'Delete account', destructive: true },
    );
  };

  return (
    <ScreenContainer>
      {/* 'height' on Android, not undefined: see journeys/new.tsx for why. */}
      <KeyboardAvoidingView style={styles.keyboardAvoider} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.avatarSection}>
            <Pressable
              onPress={() => (profile.data?.photoUrl ? setViewerOpen(true) : onPickPhoto())}
              disabled={uploadAvatar.isPending}
              style={styles.avatarPressable}
            >
              <Avatar photoUrl={profile.data?.photoUrl} displayName={profile.data?.displayName ?? ''} size={96} />
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={16} color={colors.white} />
              </View>
            </Pressable>
            <Text style={styles.avatarHint}>
              {uploadAvatar.isPending ? 'Uploading…' : profile.data?.photoUrl ? 'Tap to view photo' : 'Tap to add a photo'}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.accountRow}>
            <Text style={styles.accountEmail}>{session?.user.email}</Text>
            <Text style={session?.user.email_confirmed_at ? styles.verifiedBadge : styles.unverifiedBadge}>
              {session?.user.email_confirmed_at ? 'Verified' : 'Not verified'}
            </Text>
          </View>
          <TextField
            label="Phone number (optional)"
            placeholder="+14155552671"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <Text style={styles.hint}>Not verified — used for account recovery and important notices only.</Text>
          {phoneError ? <Text style={styles.error}>{phoneError}</Text> : null}
          {phoneSaved ? <Text style={styles.saved}>Saved!</Text> : null}
          <Button label="Save phone number" variant="secondary" onPress={onSavePhone} loading={updatePhone.isPending} />

          <View style={styles.divider} />

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
          Blocking and reporting happen from a chat or room screen directly. Deleting your account removes your
          access immediately; your data is kept per our retention policy rather than erased on the spot.
        </Text>
        <Button label="Delete my account" variant="danger" onPress={onDeleteAccount} loading={deleting} />

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
      </KeyboardAvoidingView>

      <AvatarCropModal
        uri={pickedPhotoUri}
        onCancel={() => setPickedPhotoUri(undefined)}
        onConfirm={onCropConfirmed}
      />

      <ImageViewerModal
        photoUrl={viewerOpen ? profile.data?.photoUrl : undefined}
        onClose={() => setViewerOpen(false)}
        onChangePhoto={onPickPhoto}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  keyboardAvoider: { flex: 1 },
  scroll: { paddingVertical: spacing.lg, paddingBottom: spacing.xxl },
  avatarSection: { alignItems: 'center', marginBottom: spacing.lg },
  avatarPressable: { position: 'relative' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  avatarHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  sectionTitle: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.sm },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  accountEmail: { ...typography.body, color: colors.textPrimary },
  verifiedBadge: { ...typography.caption, color: colors.success, fontWeight: '600' },
  unverifiedBadge: { ...typography.caption, color: colors.warning, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  switchLabel: { ...typography.body, color: colors.textPrimary },
  switchHint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
  saved: { ...typography.caption, color: colors.success, marginBottom: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  hint: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
});
