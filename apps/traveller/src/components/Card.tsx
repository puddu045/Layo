import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme/tokens';

/**
 * The default surface for everything from match cards to deal cards: a
 * solid white panel over the app's pastel-blue background wash, with a
 * hairline border and a subtle shadow for lift.
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
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
});
