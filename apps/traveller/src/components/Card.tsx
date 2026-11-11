import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme/tokens';

interface CardProps extends ViewProps {
  /** 'solid' (default): the everyday opaque white panel used for match/deal cards etc.
   * 'glass': translucent instead, so whatever's behind it (the welcome screen's gradient sky)
   * shows through — for the handful of cards that sit over that gradient rather than the app's
   * flat background wash. */
  variant?: 'solid' | 'glass';
}

/**
 * The default surface for everything from match cards to deal cards: a
 * solid white panel over the app's pastel-blue background wash, with a
 * hairline border and a subtle shadow for lift.
 */
export function Card({ style, children, variant = 'solid', ...rest }: CardProps) {
  return (
    <View style={[styles.card, variant === 'glass' && styles.cardGlass, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  cardGlass: {
    backgroundColor: colors.glassSurface,
    borderColor: colors.glassBorder,
  },
});
