import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View, type KeyboardTypeOptions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from './TextField';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface EditProfileFieldModalProps {
  visible: boolean;
  title: string;
  label: string;
  value: string;
  onChangeValue: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}

/** One shared editor for every single-field edit on the Settings screen (display name, bio,
 * interests, languages) — tapping a field's pencil icon opens this instead of editing inline, so
 * each field has its own obvious Save rather than one big button covering the whole section. */
export function EditProfileFieldModal({
  visible,
  title,
  label,
  value,
  onChangeValue,
  placeholder,
  multiline,
  keyboardType,
  error,
  saving,
  onCancel,
  onSave,
}: EditProfileFieldModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.avoider}>
          {/* Swallows the tap so it doesn't bubble to the backdrop and close the modal. */}
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <Pressable onPress={onCancel} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>

              <TextField
                label={label}
                value={value}
                onChangeText={onChangeValue}
                placeholder={placeholder}
                multiline={multiline}
                keyboardType={keyboardType}
                numberOfLines={multiline ? 4 : undefined}
                style={multiline ? { minHeight: 90, textAlignVertical: 'top' } : undefined}
                autoFocus
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button label="Save" onPress={onSave} loading={saving} />
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
