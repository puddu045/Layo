import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
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

interface PitchItem {
  icon: IconName;
  text: string;
  chip: string;
}

const PITCH_ITEMS: PitchItem[] = [
  { icon: 'airplane', text: 'Find travellers on your flight', chip: colors.primaryTint },
  { icon: 'business', text: 'Meet people at your departure airport', chip: colors.teal100 },
  { icon: 'location', text: 'Make the most of a layover, anywhere', chip: '#FFE4D6' },
];

const PITCH_ICON_COLOR: Record<number, string> = {
  0: colors.primary,
  1: colors.teal500,
  2: colors.sunset,
};

const CAROUSEL_INTERVAL_MS = 3200;
const FADE_DURATION_MS = 220;

function PitchRow({
  item,
  index,
  divider,
  centered,
}: {
  item: PitchItem;
  index: number;
  divider: boolean;
  // The list variant's text uses `flex: 1` so it wraps within the card's full width, which is
  // right for a stacked list but leaves a single carousel row pinned to the left with a lot of
  // empty card beside it on a wide screen — this instead sizes the row to its own content and
  // centers that as a block, so a lone row reads as a centred message, not an orphaned list item.
  centered?: boolean;
}) {
  return (
    <View style={[styles.pitchItem, divider && styles.pitchItemDivider, centered && styles.pitchItemCentered]}>
      <View style={[styles.pitchIconChip, { backgroundColor: item.chip }]}>
        <Ionicons name={item.icon} size={18} color={PITCH_ICON_COLOR[index]} />
      </View>
      <Text style={[styles.pitchText, !centered && styles.pitchTextFill]}>{item.text}</Text>
    </View>
  );
}

function PitchList() {
  return (
    <Card variant="glass">
      <View>
        {PITCH_ITEMS.map((item, index) => (
          <PitchRow key={item.text} item={item} index={index} divider={index > 0} />
        ))}
      </View>
    </Card>
  );
}

function HeroArt({ iconTranslate }: { iconTranslate: ReturnType<typeof getIconTranslate> }) {
  return (
    <View style={styles.windowFrame}>
      <View style={styles.windowFrameHighlight} />
      <View style={styles.windowRing}>
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.windowPane}>
          <View style={styles.logoHighlight} />
          <View style={styles.logoWave} />
          <View style={[styles.logoWave, styles.logoWaveFaint]} />
          <Animated.View style={iconTranslate}>
            <Ionicons name="airplane" size={32} color={colors.white} />
          </Animated.View>
        </LinearGradient>
      </View>
    </View>
  );
}

/** The "Layo" wordmark with a small coral heart accent tucked over the top-right — a
 * hand-lettered logotype look rather than a plain styled label. No separate underline: Pacifico's
 * own "y" already swings into a long tail/flourish, and a straight bar near it (tried at several
 * positions) either overlapped the tagline below, merged invisibly into the glyph itself, or cut
 * across that tail in a way that read as the logo being clipped rather than underlined — not
 * worth it on top of a font that already has a flourish like this. */
function Wordmark() {
  return (
    <View style={styles.wordmarkWrap}>
      <Text style={styles.title}>{BRAND.name}</Text>
      <Ionicons name="heart-outline" size={22} color={colors.coral} style={styles.wordmarkHeart} />
    </View>
  );
}

function getIconTranslate(flightIn: Animated.Value) {
  return {
    transform: [
      { translateX: flightIn.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) },
      { translateY: flightIn.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
      // Ionicons' "airplane" glyph points due east at rest — this rotates it to north-east.
      { rotate: '-45deg' as const },
    ],
    opacity: flightIn,
  };
}

/** The fallback for when the full list doesn't fit: one pitch at a time, cross-fading to the
 * next automatically — the dots this already had (previously just decorative) now show which
 * pitch is current instead of implying a pagination that didn't exist. */
function PitchCarousel() {
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: FADE_DURATION_MS, useNativeDriver: true }).start(() => {
        setIndex((i) => (i + 1) % PITCH_ITEMS.length);
        Animated.timing(fade, { toValue: 1, duration: FADE_DURATION_MS, useNativeDriver: true }).start();
      });
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fade]);

  return (
    <View>
      <Card variant="glass">
        <Animated.View style={[styles.carouselRow, { opacity: fade }]}>
          <PitchRow item={PITCH_ITEMS[index]} index={index} divider={false} centered />
        </Animated.View>
      </Card>
      <View style={styles.dots}>
        {PITCH_ITEMS.map((item, i) => (
          <View key={item.text} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

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

  const iconTranslate = getIconTranslate(flightIn);

  const airportImageHeight = Math.min(170, height * 0.16);
  // The source photo is 1200×360 (a 3.33:1 strip), and `resizeMode="cover"` always fills its box
  // completely — on a short box that's also very wide (a wide browser window, height capped as
  // above but width uncapped), the box's own aspect ratio can get far more extreme than the
  // photo's, so cover crops away most of the photo's height to fill that width, cutting people's
  // heads and feet off instead of just cropping the sides a little. Capping how wide the image is
  // allowed to render, relative to its own height, keeps the crop within what the photo can
  // actually support. `2 ×` the native ratio allows a moderate, deliberate-looking crop (roughly
  // half the photo's height) without going further. On phones this never engages — the screen
  // itself is narrower than this cap long before the photo's own geometry would be the limit.
  const airportImageMaxWidth = airportImageHeight * (1200 / 360) * 2;

  // Nothing on this screen scrolls. Instead, two things adapt, in order of priority — the
  // footer (both buttons, the age notice) always renders at full size no matter what, because
  // it's what this whole screen exists for:
  //  1. The pitch card: all three pitches stacked together when there's room, or one at a time
  //     auto-advancing through them when there isn't.
  //  2. The hero window-art mark: shown normally, but dropped (keeping just the title) if even
  //     the full hero plus the footer wouldn't fit together — this is what actually guarantees
  //     the footer, since a flex `middle` region can shrink to nothing on its own, but the hero
  //     and footer are both normal, non-shrinking content; without this, hero+footer could
  //     together still exceed the screen and overflow past the footer's own box (which is
  //     exactly what happened on short, wide windows before this existed).
  // All of this needs each piece's *actual* rendered height — text wraps differently at
  // different widths, so no fixed pixel budget predicts it reliably. Hidden off-screen copies
  // (below, never visible or interactive, but the same width as the real content) are measured
  // via onLayout the same way the real ones would be. Until a measurement is in, its smaller/
  // safer variant is assumed — the carousel over the full list, the compact hero over the full
  // one — since guessing small can only under-fill the screen, never overflow it.
  const [fullHeroHeight, setFullHeroHeight] = useState<number | null>(null);
  const [compactHeroHeight, setCompactHeroHeight] = useState<number | null>(null);
  const [footerHeight, setFooterHeight] = useState<number | null>(null);
  const [fullListHeight, setFullListHeight] = useState<number | null>(null);

  const budgetForHeroAndCard = footerHeight === null ? null : height - footerHeight - airportImageHeight;
  const showHeroArt =
    budgetForHeroAndCard !== null && fullHeroHeight !== null && fullHeroHeight <= budgetForHeroAndCard;
  const usedHeroHeight = showHeroArt ? fullHeroHeight : compactHeroHeight;

  const middleAvailable =
    budgetForHeroAndCard === null || usedHeroHeight === null ? null : budgetForHeroAndCard - usedHeroHeight;
  const showFullList =
    middleAvailable !== null && fullListHeight !== null && fullListHeight <= middleAvailable;

  return (
    // `minHeight: height` (from useWindowDimensions, not just `flex: 1`) is deliberate — this is
    // the one screen whose layout has to fit the viewport exactly with nothing scrolling, and
    // react-native-web's `flex: 1` height only resolves correctly if every single ancestor up to
    // the page root also has a definite height, which isn't guaranteed here. Pinning to the
    // actual known window height sidesteps that chain entirely instead of depending on it.
    <View style={[styles.root, { minHeight: height }]}>
      {/* This screen doesn't use the shared `ScreenContainer`/`GlassBackground` — it's the one
          screen with a full-bleed decorative airport illustration behind everything, which needs
          its own layered background (gradient + image) rather than the app-wide pale wash. */}
      <LinearGradient
        colors={gradients.welcomeSky}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* A safety net, not the primary mechanism: the adaptive sizing above (showHeroArt,
            showFullList) is what's supposed to make everything fit without scrolling. But its
            measurements come from this device's own onLayout passes, so anything it doesn't
            predict exactly right (a font metric quirk, a screen shorter than anyone tested)
            previously meant the hero got silently squeezed past the top edge with no way to
            reach it. `minHeight: height` on the content container keeps the layout pixel-
            identical whenever things already fit (nothing to scroll, same as before) — it only
            starts scrolling once content genuinely exceeds the viewport, trading "permanently
            cut off" for "scroll to see the rest". */}
        <ScrollView
          contentContainerStyle={{ minHeight: height }}
          showsVerticalScrollIndicator={false}
        >
        {/* Capped and centred, not full width — on a wide screen a stretched card just leaves its
            left-aligned pitch text stranded with a lot of empty card beside it, and centring that
            text instead reads as jagged across three differently-long lines. Capping the whole
            column to a comfortable reading width and centring the column itself (the airport
            photo below stays full-bleed) is what most responsive apps do here, and sidesteps the
            problem rather than fighting it at the text level. */}
        <View style={styles.contentColumn}>
          <View style={styles.hero}>
            {/* An aircraft cabin window: a plastic bezel (frame), a thin shadowed gasket ring,
                then a glass "pane" the plane's gradient sky fills, with a reflective highlight
                and a cloud-like wave clipped to it. The ring is a background-colour layer, not a
                border — a translucent border renders solid and dark on web instead of blending
                softly the way it does natively, so nesting plain-coloured views is what keeps
                this looking the same on every platform. Dropped entirely (see `showHeroArt`
                above) rather than shrunk, below a height where even showing it alongside the
                footer wouldn't fit. */}
            {showHeroArt && <HeroArt iconTranslate={iconTranslate} />}
            <Wordmark />
            <Text style={styles.tagline}>{BRAND.tagline}</Text>
          </View>

          <View style={styles.middle}>{showFullList ? <PitchList /> : <PitchCarousel />}</View>

          {/* These are the two actions this whole screen exists for, so they always render in
              full — only the hero art and pitch card above adapt to make room for them. */}
          <View style={styles.footer} onLayout={(e: LayoutChangeEvent) => setFooterHeight(e.nativeEvent.layout.height)}>
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
          </View>

          {/* Hidden measurement-only copies — never visible, never interactive, each the same
              width as `contentColumn` so their measured heights match what the real ones would
              wrap to. Rendered inside `contentColumn` (not directly in `safeArea`) specifically
              so that width matches — outside it, these would measure against the full unwrapped
              screen width instead of the capped column, over- or under-estimating how tall text
              actually wraps to. */}
          <View
            style={styles.measureHidden}
            pointerEvents="none"
            onLayout={(e: LayoutChangeEvent) => setFullListHeight(e.nativeEvent.layout.height)}
          >
            <PitchList />
          </View>
          <View
            style={styles.measureHidden}
            pointerEvents="none"
            onLayout={(e: LayoutChangeEvent) => setFullHeroHeight(e.nativeEvent.layout.height)}
          >
            <View style={styles.hero}>
              <HeroArt iconTranslate={iconTranslate} />
              <Wordmark />
              <Text style={styles.tagline}>{BRAND.tagline}</Text>
            </View>
          </View>
          <View
            style={styles.measureHidden}
            pointerEvents="none"
            onLayout={(e: LayoutChangeEvent) => setCompactHeroHeight(e.nativeEvent.layout.height)}
          >
            <View style={styles.hero}>
              <Wordmark />
              <Text style={styles.tagline}>{BRAND.tagline}</Text>
            </View>
          </View>
        </View>
        <Image
          source={require('../../assets/images/layo-airport-footer.png')}
          resizeMode="cover"
          style={[styles.airportImage, { height: airportImageHeight, maxWidth: airportImageMaxWidth }]}
        />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  airportImage: { width: '100%', alignSelf: 'center' },
  safeArea: { flex: 1 },
  // `width: '100%'` alongside `maxWidth` is required, not redundant — without it this shrinks to
  // its content's width instead of growing up to the cap, which defeats `alignSelf: 'center'`.
  // `minHeight: 0` overrides a flex item's default auto-minimum (its content's own natural size)
  // — without it, this could still be forced taller than its flex-allocated share by hero+footer
  // alone even with `showHeroArt` doing its job, and the overflow spills into the image below it
  // rather than being clipped or shrunk. The hero/footer adaptation above is the real fix; this
  // is the standard belt-and-braces flexbox rule for "a flex child that must be allowed to
  // shrink below its content size" — cheap to add, and correct regardless.
  contentColumn: { flex: 1, minHeight: 0, width: '100%', maxWidth: 480, alignSelf: 'center' },
  hero: { alignItems: 'center', paddingTop: spacing.lg, paddingHorizontal: spacing.lg },
  // `overflow: 'hidden'` is a safety net, not the primary mechanism: at an extreme enough height
  // even one carousel row plus the hero art and footer can't all fit, and a clipped row is far
  // less jarring than it overlapping the tagline above or the buttons below.
  middle: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, overflow: 'hidden' },
  measureHidden: { position: 'absolute', opacity: 0, left: 0, right: 0, top: -9999, paddingHorizontal: spacing.lg },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  // The frame is sized a touch taller than wide and very rounded — a square or a shallow
  // rectangle reads as an icon tile, but this proportion and corner radius is what makes it
  // read as a window rather than a badge.
  windowFrame: {
    width: 86,
    height: 108,
    borderRadius: 38,
    // A warm off-white, not stark white — plastic, not paper — so the bezel reads as a
    // moulded physical object instead of a flat cutout.
    backgroundColor: '#FAF9FD',
    padding: 7,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.card,
  },
  // A soft light-catch on the bezel's own surface, top-left, the way curved plastic picks up
  // light — gives the frame itself some dimension rather than reading as a flat ring.
  windowFrameHighlight: {
    position: 'absolute',
    top: -20,
    left: -16,
    width: 70,
    height: 50,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  // The gasket between the bezel and the glass — a background-colour layer, not a border.
  // A translucent border renders solid and noticeably dark on web where native blends it
  // softly against what's behind it, so this ring is implemented as plain nested views
  // (frame → ring → pane) instead, which looks identical on every platform.
  windowRing: {
    width: 72,
    height: 94,
    borderRadius: 31,
    backgroundColor: 'rgba(11, 37, 69, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  windowPane: {
    width: 68,
    height: 90,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoHighlight: {
    position: 'absolute',
    top: -28,
    left: -18,
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  logoWave: {
    position: 'absolute',
    bottom: -6,
    left: -16,
    width: 104,
    height: 34,
    borderRadius: 52,
    backgroundColor: 'rgba(255,255,255,0.3)',
    transform: [{ rotate: '-6deg' }],
  },
  logoWaveFaint: {
    bottom: -14,
    left: -22,
    opacity: 0.6,
  },
  // Wraps the wordmark text so the heart can be positioned relative to it rather than to the
  // whole hero block.
  wordmarkWrap: { alignItems: 'center' },
  // Script fonts' loops and descenders overshoot a typical sans font's em-box on every side, not
  // just top/bottom — generous line height and horizontal padding keep those strokes from
  // clipping against the text's measured box, which native text rendering enforces more strictly
  // than a web browser does for the same font. Pacifico's flourishes (the long "y" tail
  // especially) are notably larger than either font this wordmark used before it, hence the
  // generous padding here rather than the tighter values those needed.
  title: {
    fontFamily: fonts.wordmark,
    fontSize: 60,
    lineHeight: 92,
    paddingVertical: spacing.sm,
    // Horizontal, not just paddingLeft, so the box stays symmetric and the text doesn't visibly
    // shift off-centre under the window above it.
    paddingHorizontal: spacing.lg,
    color: colors.primaryDark,
  },
  // Tucked over the top-right of the "o", tilted like a quick hand-drawn flourish rather than a
  // neatly placed icon.
  wordmarkHeart: {
    position: 'absolute',
    top: 16,
    right: 20,
    transform: [{ rotate: '18deg' }],
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    // More than the usual spacing.xs — the underline stroke right above this sits close to the
    // wordmark's own glyphs by design (a large negative marginTop, see wordmarkUnderline), which
    // otherwise leaves almost no real gap before this text.
    marginTop: spacing.md,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  pitchItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  pitchItemDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  // Shrinks the row to its own content width instead of stretching across the card, so
  // `carouselRow`'s `alignItems: 'center'` can centre it as a block.
  pitchItemCentered: { alignSelf: 'center' },
  pitchIconChip: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  pitchText: { ...typography.body, color: colors.textPrimary },
  // Only for the list variant — `flex: 1` is what makes each row's text wrap within the card's
  // full width. Applying it and then trying to cancel it back out for the centred/carousel case
  // (e.g. with flexGrow: 0) left both `flex` and the longhand properties set at once, which is
  // ambiguous enough that react-native-web's text measurement broke down into wrapping almost
  // every word onto its own line. Simplest fix: the centred case just never gets this style.
  pitchTextFill: { flex: 1 },
  carouselRow: { alignItems: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md },
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
