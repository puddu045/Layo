import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { Button } from '../../src/components/Button';
import { colors, spacing, typography } from '../../src/theme/tokens';
import { BRAND } from '@layo/config';

export default function Welcome() {
  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>{BRAND.name.charAt(0)}</Text>
        </View>
        <Text style={styles.title}>{BRAND.name}</Text>
        <Text style={styles.tagline}>{BRAND.tagline}</Text>
      </View>

      <View style={styles.pitchList}>
        <PitchItem text="Find travellers on your flight" />
        <PitchItem text="Meet people at your departure airport" />
        <PitchItem text="Make the most of a layover, anywhere" />
      </View>

      <View style={styles.actions}>
        <Link href="/(auth)/register" asChild>
          <Button label="Create an account" onPress={() => {}} />
        </Link>
        <View style={{ height: spacing.sm }} />
        <Link href="/(auth)/login" asChild>
          <Button label="I already have an account" onPress={() => {}} variant="ghost" />
        </Link>
      </View>

      <Text style={styles.ageNotice}>You must be 18 or older to use {BRAND.name}.</Text>
    </ScreenContainer>
  );
}

function PitchItem({ text }: { text: string }) {
  return (
    <View style={styles.pitchItem}>
      <View style={styles.bullet} />
      <Text style={styles.pitchText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'space-between', paddingVertical: spacing.xl },
  hero: { alignItems: 'center', marginTop: spacing.xl },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.navy900,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoText: { color: colors.white, fontSize: 32, fontWeight: '700' },
  title: { ...typography.display, color: colors.navy900 },
  tagline: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  pitchList: { gap: spacing.md },
  pitchItem: { flexDirection: 'row', alignItems: 'center' },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.teal500, marginRight: spacing.sm },
  pitchText: { ...typography.body, color: colors.textPrimary },
  actions: { marginTop: spacing.lg },
  ageNotice: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },
});
