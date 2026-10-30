import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ComingSoonState } from '../../src/components/StateViews';
import { colors, spacing, typography } from '../../src/theme/tokens';

export default function Chats() {
  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
      </View>
      <ComingSoonState feature="Connections and private messaging" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.display, color: colors.navy900 },
});
