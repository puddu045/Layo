import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * The long-press menu for a chat message: always offers "Reply", and "Report" too for a message
 * that isn't the viewer's own (there's nothing to report about a message you sent yourself).
 */
export function MessageActionsSheet({
  visible,
  canReport,
  onReply,
  onReport,
  onCancel,
}: {
  visible: boolean;
  canReport: boolean;
  onReply: () => void;
  onReport: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Swallows the tap so it doesn't bubble to the backdrop's dismiss handler. */}
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <ActionRow icon="arrow-undo-outline" label="Reply" onPress={onReply} />
          {canReport && <ActionRow icon="flag-outline" label="Report" destructive onPress={onReport} />}
          <View style={styles.divider} />
          <ActionRow icon="close" label="Cancel" onPress={onCancel} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} hitSlop={4}>
      <Ionicons name={icon} size={20} color={destructive ? colors.danger : colors.textPrimary} />
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
    </Pressable>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  rowLabel: { ...typography.body, color: colors.textPrimary },
  rowLabelDestructive: { color: colors.danger },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
});
