import { forwardRef, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, spacing, typography } from '../theme/tokens';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}

/**
 * Forwards its ref so it can be used as the child of `<Link asChild>`, which
 * clones its child and attaches a ref to make the whole element navigable.
 */
export const Button = forwardRef<ComponentRef<typeof Pressable>, ButtonProps>(function Button(
  { label, onPress, variant = 'primary', loading, disabled, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
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
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.navy900 : colors.white} />
      ) : (
        <Text style={[styles.label, textVariantStyles[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    overflow: 'hidden',
  },
  label: { ...typography.subtitle },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});

const variantStyles = StyleSheet.create({
  secondary: { backgroundColor: colors.glassSurfaceStrong, borderWidth: 1, borderColor: colors.glassBorder },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.danger },
});

const textVariantStyles = StyleSheet.create({
  primary: { color: colors.white },
  secondary: { color: colors.navy900 },
  ghost: { color: colors.navy900 },
  danger: { color: colors.white },
});
