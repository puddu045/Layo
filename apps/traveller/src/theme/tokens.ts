/**
 * Design tokens for the traveller app. Navy/teal is still the brand anchor,
 * but the palette now carries a handful of vibrant accents (sky, coral,
 * sunset, violet) and a glass vocabulary (translucent surfaces + soft
 * gradient "orbs") for an iOS-style frosted-glass look — cards float over a
 * softly colourful background instead of flat white.
 */
export const colors = {
  navy900: '#0B2545',
  navy700: '#13335C',
  navy500: '#1D4E89',
  teal500: '#1FA2A6',
  teal100: '#E3F6F5',
  /** The one accent used for "this is selected/active" across the whole app — the active tab
   * bar icon, its highlight pill, anything else that needs a single consistent theme colour
   * rather than a different hue per spot. Aliased to teal500, already the app's existing link/
   * category accent, so this doesn't introduce a second brand colour. */
  accent: '#1FA2A6',

  // Vibrant accents — used for gradients, badges, and background "orbs",
  // not for body text (keep those on navy/textPrimary for contrast).
  sky: '#4FA8FF',
  violet: '#8B6CF2',
  coral: '#FF6B81',
  sunset: '#FFA94D',

  white: '#FFFFFF',
  background: '#F3F2FA',
  surface: '#FFFFFF',
  border: '#E3E8F0',
  textPrimary: '#0F1A2B',
  textSecondary: '#5A6B85',
  textInverse: '#FFFFFF',
  success: '#2F9E5B',
  warning: '#C98A1C',
  danger: '#C94B3F',

  // Glass surfaces: a translucent white over a BlurView, plus a hairline
  // border that catches the light the way iOS's material cards do.
  glassSurface: 'rgba(255, 255, 255, 0.55)',
  glassSurfaceStrong: 'rgba(255, 255, 255, 0.72)',
  glassBorder: 'rgba(255, 255, 255, 0.5)',
};

export const gradients = {
  hero: ['#0B2545', '#1D4E89', '#4FA8FF'] as const,
  primaryButton: ['#13335C', '#0B2545'] as const,
  /** The single wash every screen sits on (`GlassBackground`) — one smooth diagonal gradient,
   * not scattered colour blobs: a pale sky tint settling into the neutral background. */
  screen: ['#E8F0FE', '#F3F2FA', '#F7F6FB'] as const,
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
 * pulling a whole second typeface into every screen. Pacifico only ships one weight. */
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
    shadowColor: '#0B2545',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
};
