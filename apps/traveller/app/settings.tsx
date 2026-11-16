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
import { ChangePasswordModal } from '../src/components/ChangePasswordModal';
import { EditProfileFieldModal } from '../src/components/EditProfileFieldModal';
import { Button } from '../src/components/Button';
import { ErrorState, LoadingState } from '../src/components/StateViews';
import { useAuth } from '../src/lib/auth-context';
import { useDeleteAccount, useOwnProfile, useUpdatePhone, useUpdateProfile } from '../src/hooks/api-hooks';
import { useUploadAvatar } from '../src/hooks/avatar-hooks';
import { notifyConfirm, notifyInfo } from '../src/lib/notify';
import { ApiError } from '../src/lib/api-client';
import { colors, radius, spacing, typography } from '../src/theme/tokens';

type ProfileField = 'displayName' | 'bio' | 'interests' | 'languages' | 'phone';

const FIELD_META: Record<
  ProfileField,
  { title: string; label: string; multiline?: boolean; placeholder: string; keyboardType?: 'phone-pad' }
> = {
  displayName: { title: 'Display name', label: 'Display name', placeholder: 'Your name' },
  bio: {
    title: 'Bio',
    label: 'Bio',
    multiline: true,
    placeholder: 'Tell other travellers a bit about you',
  },
  interests: {
    title: 'Interests',
    label: 'Interests (comma separated)',
    placeholder: 'Hiking, photography, coffee',
  },
  languages: {
    title: 'Languages',
    label: 'Languages (comma separated)',
    placeholder: 'English, Spanish',
  },
  phone: {
    title: 'Phone number',
    label: 'Phone number (optional)',
    placeholder: '+14155552671',
    keyboardType: 'phone-pad',
  },
};

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

  const [discoverable, setDiscoverable] = useState(true);

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const [editingField, setEditingField] = useState<ProfileField | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();

  useEffect(() => {
    if (profile.data) {
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

  const currentFieldText = (field: ProfileField): string => {
    if (!profile.data) return '';
    switch (field) {
      case 'displayName':
        return profile.data.displayName;
      case 'bio':
        return profile.data.bio;
      case 'interests':
        return profile.data.interests.join(', ');
      case 'languages':
        return profile.data.languages.join(', ');
      case 'phone':
        return profile.data.phone ?? '';
    }
  };

  const openEditor = (field: ProfileField) => {
    setFieldError(undefined);
    setDraftValue(currentFieldText(field));
    setEditingField(field);
  };

  const closeEditor = () => {
    setEditingField(null);
    setFieldError(undefined);
  };

  // Phone has its own endpoint/schema (it's verification-gated, unlike the rest of the profile),
  // so this branches to `useUpdatePhone` for that one field but otherwise shares the same
  // open-a-modal-per-field flow as the plain profile fields.
  const onSaveField = async () => {
    if (!editingField) return;
    setFieldError(undefined);

    if (editingField === 'phone') {
      const parsed = updatePhoneRequestSchema.safeParse({ phone: draftValue.trim() || null });
      if (!parsed.success) {
        setFieldError(parsed.error.issues[0]?.message ?? 'Enter a valid phone number');
        return;
      }
      try {
        await updatePhone.mutateAsync(parsed.data);
        closeEditor();
      } catch (err) {
        setFieldError(err instanceof ApiError ? err.message : 'Could not save your phone number');
      }
      return;
    }

    const payload =
      editingField === 'interests' || editingField === 'languages'
        ? { [editingField]: draftValue.split(',').map((s) => s.trim()).filter(Boolean) }
        : { [editingField]: draftValue.trim() };

    const parsed = updateProfileRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Please check this field');
      return;
    }
    try {
      await updateProfile.mutateAsync(parsed.data);
      closeEditor();
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : 'Could not save changes');
    }
  };

  const onToggleDiscoverable = (value: boolean) => {
    setDiscoverable(value);
    updateProfile.mutate(
      { discoverable: value },
      { onError: () => setDiscoverable(!value) },
    );
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
            {/* Nested Pressables, innermost wins the touch (same pattern as chats.tsx's avatar-vs-row
                split) — tapping the photo enlarges it, tapping the camera badge on top of it picks a
                new one directly, instead of the badge just triggering the same enlarge as the photo. */}
            <Pressable
              onPress={() => (profile.data?.photoUrl ? setViewerOpen(true) : onPickPhoto())}
              disabled={uploadAvatar.isPending}
              style={styles.avatarPressable}
            >
              <Avatar photoUrl={profile.data?.photoUrl} displayName={profile.data?.displayName ?? ''} size={96} />
              <Pressable
                onPress={onPickPhoto}
                disabled={uploadAvatar.isPending}
                hitSlop={6}
                style={styles.avatarEditBadge}
              >
                <Ionicons name="camera" size={16} color={colors.white} />
              </Pressable>
            </Pressable>
            <Text style={styles.avatarHint}>
              {uploadAvatar.isPending
                ? 'Uploading…'
                : profile.data?.photoUrl
                  ? 'Tap photo to view, tap camera to change'
                  : 'Tap to add a photo'}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.accountRow}>
            <Text style={styles.accountEmail}>{session?.user.email}</Text>
            <Text style={session?.user.email_confirmed_at ? styles.verifiedBadge : styles.unverifiedBadge}>
              {session?.user.email_confirmed_at ? 'Verified' : 'Not verified'}
            </Text>
          </View>
          <ProfileFieldRow
            label="Phone number"
            value={profile.data?.phone || 'Add a phone number'}
            onPress={() => openEditor('phone')}
          />
          <Text style={styles.hint}>Not verified — used for account recovery and important notices only.</Text>

          <View style={{ marginTop: spacing.sm }}>
            <Button label="Change password" variant="secondary" onPress={() => setChangePasswordOpen(true)} />
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Profile</Text>
        <ProfileFieldRow
          label="Display name"
          value={profile.data?.displayName || '—'}
          onPress={() => openEditor('displayName')}
        />
        <ProfileFieldRow
          label="Bio"
          value={profile.data?.bio || 'Add a short bio'}
          onPress={() => openEditor('bio')}
        />
        <ProfileFieldRow
          label="Interests"
          value={profile.data?.interests.length ? profile.data.interests.join(', ') : 'Add your interests'}
          onPress={() => openEditor('interests')}
        />
        <ProfileFieldRow
          label="Languages"
          value={profile.data?.languages.length ? profile.data.languages.join(', ') : 'Add languages you speak'}
          onPress={() => openEditor('languages')}
        />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Discoverable to other travellers</Text>
            <Text style={styles.switchHint}>Turn this off to hide yourself from everyone's Discover tab.</Text>
          </View>
          <Switch value={discoverable} onValueChange={onToggleDiscoverable} />
        </View>

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

      <ChangePasswordModal visible={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />

      <EditProfileFieldModal
        visible={editingField !== null}
        title={editingField ? FIELD_META[editingField].title : ''}
        label={editingField ? FIELD_META[editingField].label : ''}
        placeholder={editingField ? FIELD_META[editingField].placeholder : undefined}
        multiline={editingField ? FIELD_META[editingField].multiline : undefined}
        keyboardType={editingField ? FIELD_META[editingField].keyboardType : undefined}
        value={draftValue}
        onChangeValue={setDraftValue}
        error={fieldError}
        saving={editingField === 'phone' ? updatePhone.isPending : updateProfile.isPending}
        onCancel={closeEditor}
        onSave={onSaveField}
      />
    </ScreenContainer>
  );
}

function ProfileFieldRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={fieldRowStyles.row}>
      <View style={{ flex: 1 }}>
        <Text style={fieldRowStyles.label}>{label}</Text>
        <Text style={fieldRowStyles.value} numberOfLines={3}>
          {value}
        </Text>
      </View>
      <Ionicons name="pencil" size={18} color={colors.primary} />
    </Pressable>
  );
}

const fieldRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  label: { ...typography.label, color: colors.textSecondary, marginBottom: 2 },
  value: { ...typography.body, color: colors.textPrimary },
});

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
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  hint: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
});
