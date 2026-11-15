/**
 * Design tokens for the traveller app: a pastel-peach wash with navy-blue ink and accents.
 * `navy900` is the text-ink colour; `primary` is the one action colour for every interactive
 * surface app-wide — buttons, the active tab, links. Cards are a translucent, near-white frosted
 * glass (`glassSurface`) over the peach `background`/`gradients.screen` wash, not solid white —
 * see `Card`.
 */
export const colors = {
  navy900: '#17365D',
  navy700: '#285580',
  navy500: '#2878C7',
  teal500: '#73B9D4',
  teal100: '#E8F7FC',

  // Pastel blue theme
  primaryLight: '#A9D6F5',
  primary: '#2878C7',
  primaryDark: '#1E5D96',
  primaryTint: '#E3F2FD',

  // Consistent active and selected colour
  accent: '#2878C7',

  // Soft complementary accents
  sky: '#A9D6F5',
  violet: '#C5D8FA',
  coral: '#F6B7C5',
  sunset: '#FFD7AD',

  // Base surfaces
  white: '#FFFFFF',
  background: '#FFE8DA',
  surface: '#FFFFFF',
  border: '#F3DCC8',

  // Text
  textPrimary: '#17324D',
  textSecondary: '#607D99',
  textInverse: '#FFFFFF',

  // Status colours
  success: '#3B9B79',
  warning: '#C98A1C',
  danger: '#C94B3F',

  // The one frosted-glass card surface — every `Card`, everywhere (list rows, match/deal cards,
  // the welcome screen's pitch card). Near-white rather than strongly peach-tinted, and fairly
  // opaque: a fill close in hue to the peach wash behind it (tried first) just blended into the
  // background instead of reading as a card sitting above it — lightness contrast is what makes
  // it pop, the translucency alone isn't enough. `glassBorder` is a crisper white hairline for
  // the same reason, paired with `shadow.card` for lift.
  glassSurface: 'rgba(255, 248, 242, 0.85)',
  glassBorder: 'rgba(255, 255, 255, 0.8)',
  // The sender's own chat bubble — translucent `primary` blue rather than the old flat opaque
  // navy, so it reads as the same glass language as everything else instead of being the one
  // leftover solid surface in the app.
  glassSurfaceBlue: 'rgba(40, 120, 199, 0.82)',
};

export const gradients = {
  // The plane's window "sky", inside the cabin-window mark — kept blue regardless of the app's
  // own peach wash, since it's meant to read as sky glimpsed through a window, not the page
  // background.
  hero: ['#A9D6F5', '#D7ECFB', '#EFF7FF'] as const,

  primaryButton: ['#3E8FD6', '#2878C7'] as const,

  // The app-wide background wash (see `GlassBackground`) — every screen except the welcome
  // carousel sits on this.
  screen: ['#FFE4D2', '#FFEEE3', '#FFF9F5'] as const,

  // The richer, more saturated variant — the welcome screen's full-bleed background, and
  // `GlassBackground`'s "bold" variant for any other screen with no dense text to protect.
  welcomeSky: ['#FFD9BE', '#FFE7D5', '#FFF4EC'] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
};

/** Loaded in the root layout (`app/_layout.tsx`) via `useFonts` before anything renders — only
 * used for the "Layo" wordmark itself, not body text, to keep that one distinctive without
 * pulling a whole second typeface into every screen. */
export const fonts = {
  wordmark: 'Pacifico_400Regular',
};

export const typography = {
  display: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  title: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  subtitle: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600' as const, lineHeight: 16 },
};

/** iOS-only shadow props (shadowColor/Offset/Opacity/Radius are ignored on Android). Deliberately
 * no `elevation`: Android's elevation forces an offscreen shadow render pass per view, and inside
 * a FlatList that recycles views on scroll it's a well-known source of "ghost" shadow/content
 * artifacts — a stale shadow layer left behind at an old scroll position. A plain hairline border
 * (`colors.glassBorder`, already on `Card`) carries the card's edge on Android instead. */
export const shadow = {
  card: {
    shadowColor: '#17365D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
};
