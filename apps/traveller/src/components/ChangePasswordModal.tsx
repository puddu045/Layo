import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resetPasswordRequestSchema } from '@layo/contracts';
import { TextField } from './TextField';
import { Button } from './Button';
import { useAuth } from '../lib/auth-context';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Re-verifies the current password (via `changePassword`) before actually changing it — see
 * `auth-context.tsx`'s comment on why that check matters here specifically. */
export function ChangePasswordModal({ visible, onClose }: ChangePasswordModalProps) {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setError(undefined);
    onClose();
  };

  const onSubmit = async () => {
    setError(undefined);
    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match');
      return;
    }
    const parsed = resetPasswordRequestSchema.safeParse({ password: newPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid password');
      return;
    }
    if (!currentPassword) {
      setError('Enter your current password');
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, parsed.data.password);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.avoider}>
          {/* Swallows the tap so it doesn't bubble to the backdrop and close the modal. */}
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              <View style={styles.header}>
                <Text style={styles.title}>Change password</Text>
                <Pressable onPress={handleClose} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>

              <TextField
                label="Current password"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <TextField label="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
              <TextField
                label="Confirm new password"
                secureTextEntry
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button label="Change password" onPress={onSubmit} loading={submitting} />
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 20, 33, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  avoider: { width: '100%', maxWidth: 420 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { ...typography.subtitle, color: colors.textPrimary },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
});
