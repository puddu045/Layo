import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme/tokens';

/**
 * The default surface for everything from match cards to deal cards: a
 * translucent "glass" panel over `GlassBackground`'s colour wash — a tinted
 * white fill with a hairline highlight border and a soft shadow.
 *
 * Deliberately not a real BlurView: `expo-blur` on Android doesn't reliably
 * blur the content behind it inside this nav stack (it rendered as a flat,
 * sharp-edged box instead of a soft frosted panel — worse than no blur), so
 * a plain translucent tint is the version that actually looks right on every
 * platform rather than the version that looks best in theory on one.
 */
export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glassSurfaceStrong,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
    ...shadow.card,
  },
});
