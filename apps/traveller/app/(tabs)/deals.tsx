import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ComingSoonState } from '../../src/components/StateViews';
import { colors, spacing, typography } from '../../src/theme/tokens';

export default function Deals() {
  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Deals</Text>
      </View>
      <ComingSoonState feature="Airport shopping, dining and lounge deals" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.display, color: colors.navy900 },
});
