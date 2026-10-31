import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { colors, fonts, gradients, shadow, spacing, typography } from '../../src/theme/tokens';
import { BRAND } from '@layo/config';

export default function Welcome() {
  // Only the plane itself flies in — from the south-west, settling at the circle's centre — the
  // gradient circle it lands in never moves.
  const flightIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(flightIn, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [flightIn]);

  const iconTranslate = {
    transform: [
      { translateX: flightIn.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) },
      { translateY: flightIn.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
      // Ionicons' "airplane" glyph points due east at rest — this rotates it to north-east.
      { rotate: '-45deg' },
    ],
    opacity: flightIn,
  };

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.hero}>
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoCircle}
        >
          <Animated.View style={iconTranslate}>
            <Ionicons name="airplane" size={32} color={colors.white} />
          </Animated.View>
        </LinearGradient>
        <Text style={styles.title}>{BRAND.name}</Text>
        <Text style={styles.tagline}>{BRAND.tagline}</Text>
      </View>

      <Card>
        <View style={styles.pitchList}>
          <PitchItem text="Find travellers on your flight" color={colors.sky} />
          <PitchItem text="Meet people at your departure airport" color={colors.violet} />
          <PitchItem text="Make the most of a layover, anywhere" color={colors.coral} />
        </View>
      </Card>

      <View style={styles.actions}>
        {/* Direct router.push, not <Link asChild> — wrapping this Button in Link asChild lost its
            background style entirely (Expo Router clones the child without resolving a function
            style), leaving an invisible button. */}
        <Button label="Create an account" onPress={() => router.push('/(auth)/register')} />
        <View style={{ height: spacing.sm }} />
        <Button label="I already have an account" onPress={() => router.push('/(auth)/login')} variant="ghost" />
      </View>

      <Text style={styles.ageNotice}>You must be 18 or older to use {BRAND.name}.</Text>
    </ScreenContainer>
  );
}

function PitchItem({ text, color }: { text: string; color: string }) {
  return (
    <View style={styles.pitchItem}>
      <View style={[styles.bullet, { backgroundColor: color }]} />
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadow.card,
  },
  title: { fontFamily: fonts.wordmark, fontSize: 34, lineHeight: 40, letterSpacing: 0.3, color: colors.navy900 },
  tagline: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  pitchList: { gap: spacing.md },
  pitchItem: { flexDirection: 'row', alignItems: 'center' },
  bullet: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  pitchText: { ...typography.body, color: colors.textPrimary },
  actions: { marginTop: spacing.lg },
  ageNotice: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },
});
