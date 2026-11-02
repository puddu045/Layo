import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface ChipProps {
  label: string;
  /** Optional leading icon — used by filter chips (Discover, Deals). */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Makes this a pressable filter chip instead of a static info chip (interests, categories). */
  onPress?: () => void;
  selected?: boolean;
}

export function Chip({ label, icon, onPress, selected }: ChipProps) {
  const content = (
    <View style={[styles.chip, selected && styles.chipSelected]}>
      {icon && (
        <Ionicons
          name={icon}
          size={14}
          color={selected ? colors.white : colors.navy700}
          style={styles.icon}
        />
      )}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} hitSlop={4}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  chipSelected: { backgroundColor: colors.primary },
  icon: { marginRight: 4 },
  label: { ...typography.caption, color: colors.navy700, fontWeight: '600' },
  labelSelected: { color: colors.white },
});
