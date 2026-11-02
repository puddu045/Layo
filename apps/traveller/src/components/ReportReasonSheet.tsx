import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReportReason } from '@layo/contracts';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '../theme/tokens';

const REASON_LABELS: Record<ReportReason, string> = {
  HARASSMENT: 'Abusive language or harassment',
  SPAM: 'Spam or marketing',
  INAPPROPRIATE_CONTENT: 'Inappropriate content',
  IMPERSONATION: 'Impersonation',
  SAFETY_CONCERN: 'Safety concern',
  OTHER: 'Something else',
};
const REASON_ORDER: ReportReason[] = [
  'HARASSMENT',
  'SPAM',
  'INAPPROPRIATE_CONTENT',
  'IMPERSONATION',
  'SAFETY_CONCERN',
  'OTHER',
];

/**
 * Shown when blocking someone — reporting is optional (a reason can be picked or left unset),
 * but offering it right at the moment of blocking is the one time a user is already telling us
 * "something is wrong", so it's the natural place to ask why instead of a separate flow nobody
 * would go looking for afterwards.
 */
export function ReportReasonSheet({
  visible,
  targetName,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  targetName: string;
  onCancel: () => void;
  onConfirm: (reason?: ReportReason) => void;
}) {
  const [reason, setReason] = useState<ReportReason | undefined>(undefined);

  const confirm = () => {
    onConfirm(reason);
    setReason(undefined);
  };

  const cancel = () => {
    setReason(undefined);
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
      <Pressable style={styles.backdrop} onPress={cancel}>
        {/* Swallows the tap so it doesn't bubble to the backdrop's dismiss handler. */}
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Block {targetName}?</Text>
          <Text style={styles.subtitle}>
            You won&apos;t see each other in Discover or be able to message anymore. You can also let us know why,
            which helps us review their account — this is optional.
          </Text>

          <View style={styles.reasonList}>
            {REASON_ORDER.map((r) => (
              <Pressable
                key={r}
                style={styles.reasonRow}
                onPress={() => setReason(reason === r ? undefined : r)}
              >
                <View style={[styles.radio, reason === r && styles.radioSelected]}>
                  {reason === r && <Ionicons name="checkmark" size={13} color={colors.white} />}
                </View>
                <Text style={styles.reasonLabel}>{REASON_LABELS[r]}</Text>
              </Pressable>
            ))}
          </View>

          <Button label={reason ? 'Block and report' : 'Block'} variant="danger" onPress={confirm} />
          <View style={{ height: spacing.sm }} />
          <Button label="Cancel" variant="ghost" onPress={cancel} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 26, 43, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  reasonList: { marginBottom: spacing.lg },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { backgroundColor: colors.danger, borderColor: colors.danger },
  reasonLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
});
