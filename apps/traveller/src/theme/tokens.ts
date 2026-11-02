/**
 * Design tokens for the traveller app: a pastel-blue palette. `navy900` is
 * the text-ink colour; `primary` is the one action colour for every
 * interactive surface app-wide — buttons, the active tab, links. Cards are
 * solid white (`surface`) on the soft blue `background`/`gradients.screen`
 * wash, not translucent glass — see `Card`.
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
  background: '#EFF7FF',
  surface: '#FFFFFF',
  border: '#DCEAF7',

  // Text
  textPrimary: '#17324D',
  textSecondary: '#607D99',
  textInverse: '#FFFFFF',

  // Status colours
  success: '#3B9B79',
  warning: '#C98A1C',
  danger: '#C94B3F',

  // Glass surfaces — still used for a couple of translucent overlays (e.g. the welcome screen's
  // hero card); everyday cards/buttons use solid `surface`/`primaryTint` instead, see `Card`.
  glassSurface: 'rgba(255, 255, 255, 0.65)',
  glassSurfaceStrong: 'rgba(255, 255, 255, 0.35)',
  glassSurfaceStrongMatch: 'rgba(255, 255, 255, 0.60)',
  glassBorder: 'rgba(255, 255, 255, 0.65)',
};

export const gradients = {
  hero: ['#A9D6F5', '#D7ECFB', '#EFF7FF'] as const,

  primaryButton: ['#3E8FD6', '#2878C7'] as const,

  screen: ['#E3F2FD', '#EFF7FF', '#FAFCFF'] as const,

  welcomeSky: ['#B8DCFA', '#D9ECFF', '#F3F9FF'] as const,
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
