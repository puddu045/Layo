import { forwardRef, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients, radius, spacing, typography } from '../theme/tokens';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Optional leading icon, e.g. for a signup CTA (`icon="person"`). */
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * Forwards its ref so it can be used as the child of `<Link asChild>`, which
 * clones its child and attaches a ref to make the whole element navigable.
 */
export const Button = forwardRef<ComponentRef<typeof Pressable>, ButtonProps>(function Button(
  { label, onPress, variant = 'primary', icon, loading, disabled, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  const textColor =
    variant === 'secondary' ? colors.navy900 : variant === 'ghost' ? colors.primary : colors.white;

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant !== 'primary' && variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
      {...rest}
    >
      {variant === 'primary' && (
        <LinearGradient
          colors={gradients.primaryButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon && <Ionicons name={icon} size={18} color={textColor} style={styles.icon} />}
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    overflow: 'hidden',
  },
  content: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: spacing.xs },
  label: { ...typography.subtitle },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});

const variantStyles = StyleSheet.create({
  secondary: { backgroundColor: colors.primaryTint, borderWidth: 1, borderColor: colors.primaryLight },
  ghost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  danger: { backgroundColor: colors.danger },
});
