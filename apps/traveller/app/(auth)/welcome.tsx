import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import {
  colors,
  fonts,
  gradients,
  radius,
  shadow,
  spacing,
  typography,
} from '../../src/theme/tokens';
import { BRAND } from '@layo/config';

type IconName = keyof typeof Ionicons.glyphMap;

const PITCH_ITEMS: Array<{ icon: IconName; text: string; chip: string }> = [
  { icon: 'airplane', text: 'Find travellers on your flight', chip: colors.primaryTint },
  { icon: 'business', text: 'Meet people at your departure airport', chip: colors.teal100 },
  { icon: 'location', text: 'Make the most of a layover, anywhere', chip: '#FFE4D6' },
];

const PITCH_ICON_COLOR: Record<number, string> = {
  0: colors.primary,
  1: colors.teal500,
  2: colors.sunset,
};

export default function Welcome() {
  // Only the plane itself flies in — from the south-west, settling at the mark's centre — the
  // gradient mark it lands in never moves.
  const flightIn = useRef(new Animated.Value(0)).current;
  const { height } = useWindowDimensions();

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

  // The airport illustration needs dedicated space at the bottom, not just a backdrop the last
  // bit of content floats over — on a short viewport there often isn't room for both, so this
  // screen scrolls (most screens don't need to) with enough bottom padding that the image always
  // has clear room below the age notice instead of covering the buttons.
  const airportImageHeight = Math.min(170, height * 0.16);

  return (
    <View style={styles.root}>
      {/* This screen doesn't use the shared `ScreenContainer`/`GlassBackground` — it's the one
          screen with a full-bleed decorative airport illustration behind everything, which needs
          its own layered background (gradient + image) rather than the app-wide pale wash. */}
      <LinearGradient
        colors={gradients.welcomeSky}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Image
        source={require('../../assets/images/layo-airport-footer.png')}
        resizeMode="cover"
        style={[styles.airportImage, { height: airportImageHeight }]}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { minHeight: height, paddingBottom: airportImageHeight + spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <LinearGradient
              colors={gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoMark}
            >
              {/* A glossy top highlight and a soft wave under the plane — plain translucent
                  shapes, clipped by the mark's own rounded corners, rather than pulling in an SVG
                  library for two decorations. */}
              <View style={styles.logoHighlight} />
              <View style={styles.logoWave} />
              <View style={[styles.logoWave, styles.logoWaveFaint]} />
              <Animated.View style={iconTranslate}>
                <Ionicons name="airplane" size={38} color={colors.white} />
              </Animated.View>
            </LinearGradient>
            <Text style={styles.title}>{BRAND.name}</Text>
            <Text style={styles.tagline}>{BRAND.tagline}</Text>
          </View>

          <Card>
            <View style={styles.pitchList}>
              {PITCH_ITEMS.map((item, index) => (
                <View
                  key={item.text}
                  style={[styles.pitchItem, index > 0 && styles.pitchItemDivider]}
                >
                  <View style={[styles.pitchIconChip, { backgroundColor: item.chip }]}>
                    <Ionicons name={item.icon} size={18} color={PITCH_ICON_COLOR[index]} />
                  </View>
                  <Text style={styles.pitchText}>{item.text}</Text>
                </View>
              ))}
            </View>
          </Card>

          <View style={styles.dots}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>

          <View style={styles.actions}>
            {/* Direct router.push, not <Link asChild> — wrapping this Button in Link asChild lost
                its background style entirely (Expo Router clones the child without resolving a
                function style), leaving an invisible button. */}
            <Button
              label="Create an account"
              icon="person"
              onPress={() => router.push('/(auth)/register')}
            />
            <View style={{ height: spacing.sm }} />
            <Button
              label="I already have an account"
              onPress={() => router.push('/(auth)/login')}
              variant="ghost"
            />
          </View>

          <Text style={styles.ageNotice}>You must be 18 or older to use {BRAND.name}.</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  airportImage: { position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%' },
  safeArea: { flex: 1 },
  container: {
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  hero: { alignItems: 'center', marginTop: spacing.lg },
  logoMark: {
    width: 92,
    height: 92,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    // marginBottom: spacing.xs,
    overflow: 'hidden',
    ...shadow.card,
  },
  logoHighlight: {
    position: 'absolute',
    top: -36,
    left: -24,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  logoWave: {
    position: 'absolute',
    bottom: -8,
    left: -20,
    width: 132,
    height: 42,
    borderRadius: 66,
    backgroundColor: 'rgba(255,255,255,0.3)',
    transform: [{ rotate: '-6deg' }],
  },
  logoWaveFaint: {
    bottom: -20,
    left: -30,
    opacity: 0.6,
  },
  // Script/italic fonts' loops and descenders overshoot a typical sans font's em-box on every
  // side, not just top/bottom — generous line height and horizontal padding keep those strokes
  // from clipping against the text's measured box.
  title: {
    fontFamily: fonts.wordmark,
    fontSize: 48,
    lineHeight: 82,
    paddingVertical: spacing.xs,
    // Horizontal, not just paddingLeft, so the box stays symmetric and the text doesn't visibly
    // shift off-centre under the logo mark above it.
    paddingHorizontal: spacing.sm,
    color: colors.navy900,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  pitchList: {},
  pitchItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  pitchItemDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  pitchIconChip: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  pitchText: { ...typography.body, color: colors.textPrimary, flex: 1 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.lg },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 18, backgroundColor: colors.primary },
  actions: { marginTop: spacing.lg },
  ageNotice: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
