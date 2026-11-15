import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme/tokens';

interface CardProps extends ViewProps {
  /** No visual difference any more — every card uses the same translucent glass surface now,
   * on every background it sits over (see `colors.glassSurface`). Kept as a prop rather than
   * removed outright so call sites that pass `variant="glass"` don't need to change too. */
  variant?: 'solid' | 'glass';
}

/**
 * The default surface for everything from match cards to deal cards: a translucent, near-white
 * frosted glass panel over the app's background wash (see `colors.glassSurface`), with a crisp
 * white hairline rim and a subtle shadow for lift — not solid white, so the wash behind it still
 * shows through, but light enough to still read clearly as a card sitting above it.
 */
export function Card({ style, children, variant: _variant, ...rest }: CardProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glassSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
    ...shadow.card,
  },
});
