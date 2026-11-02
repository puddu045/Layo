/**
 * Design tokens for the traveller app. Navy is still the text-ink colour,
 * but `primary` (violet) is now the one theme colour for every interactive
 * surface app-wide — buttons, the active tab, the logo mark — carried by a
 * handful of vibrant accents (sky, coral, sunset, violet itself) for badges
 * and icon chips, and a glass vocabulary (translucent surfaces) for an
 * iOS-style look — cards float over a softly colourful background instead
 * of flat white.
 */
// export const colors = {
//   navy900: '#0B2545',
//   navy700: '#13335C',
//   navy500: '#1D4E89',
//   teal500: '#1FA2A6',
//   teal100: '#E3F6F5',

//   // The app's one theme colour — every button, active tab, and link-style
//   // accent now reads from this family instead of navy or teal.
//   primaryLight: '#8E7CF0',
//   primary: '#6C5DD3',
//   primaryDark: '#5243B0',
//   primaryTint: '#EDE9FB',

//   /** The one accent used for "this is selected/active" across the whole app — the active tab
//    * bar icon, its highlight pill, anything else that needs a single consistent theme colour
//    * rather than a different hue per spot. */
//   accent: '#6C5DD3',

//   // Vibrant accents — used for gradients, badges, and background "orbs",
//   // not for body text (keep those on navy/textPrimary for contrast).
//   sky: '#4FA8FF',
//   violet: '#8B6CF2',
//   coral: '#FF6B81',
//   sunset: '#FFA94D',

//   white: '#FFFFFF',
//   background: '#F3F1FA',
//   surface: '#FFFFFF',
//   border: '#E3E8F0',
//   textPrimary: '#0F1A2B',
//   textSecondary: '#5A6B85',
//   textInverse: '#FFFFFF',
//   success: '#2F9E5B',
//   warning: '#C98A1C',
//   danger: '#C94B3F',

//   // Glass surfaces: a translucent white over a BlurView, plus a hairline
//   // border that catches the light the way iOS's material cards do.
//   glassSurface: 'rgba(255, 255, 255, 0.55)',
//   glassSurfaceStrong: 'rgba(255, 255, 255, 0.30)',
//   glassSurfaceStrongMatch: 'rgba(255, 255, 255, 0.50)',
//   glassBorder: 'rgba(255, 255, 255, 0.5)',
// };

// export const gradients = {
//   hero: ['#8E7CF0', '#6C5DD3', '#B46EBF', '#F2A0BB'] as const,
//   primaryButton: ['#8E7CF0', '#6C5DD3'] as const,
//   /** The single wash every screen sits on (`GlassBackground`) — one smooth diagonal gradient,
//    * not scattered colour blobs: a pale violet tint settling into the neutral background. Kept
//    * pale everywhere except the welcome screen, which uses `welcomeSky` instead, so cards full of
//    * text stay easy to read. */
//   screen: ['#EFECFB', '#F3F1FA', '#F8F6FB'] as const,
//   /** The bolder lavender → pink → peach "sky" behind the welcome screen specifically — it has no
//    * dense text to protect, so it can afford to be much more saturated than `screen`. */
//   welcomeSky: ['#D9D2F5', '#F0DCEC', '#FCE3D3'] as const,
// };

export const colors = {
  navy900: '#17365D',
  navy700: '#285580',
  navy500: '#4F8CCF',
  teal500: '#73B9D4',
  teal100: '#E8F7FC',

  // Pastel blue theme
  primaryLight: '#A9D4F5',
  primary: '#7BADE8',
  primaryDark: '#245D9A',
  primaryTint: '#E7F3FF',

  // Consistent active and selected colour
  accent: '#4F8CCF',

  // Soft complementary accents
  sky: '#A9D4F5',
  violet: '#C5D8FA',
  coral: '#F6B7C5',
  sunset: '#FFD7AD',

  // Base surfaces
  white: '#FFFFFF',
  background: '#F4F9FF',
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

  // Glass surfaces
  glassSurface: 'rgba(255, 255, 255, 0.65)',
  glassSurfaceStrong: 'rgba(255, 255, 255, 0.35)',
  glassSurfaceStrongMatch: 'rgba(255, 255, 255, 0.60)',
  glassBorder: 'rgba(255, 255, 255, 0.65)',
};

export const gradients = {
  hero: ['#A9D4F5', '#7BADE8', '#B8DDF5', '#E0F2FF'] as const,

  primaryButton: ['#8DBCEB', '#4F8CCF'] as const,

  screen: ['#EAF5FF', '#F4F9FF', '#FAFCFF'] as const,

  welcomeSky: ['#B8DCFA', '#D9ECFF', '#F3F9FF'] as const,
};

// export const colors = {
//   // Navy: headings, buttons and strong contrast
//   navy900: '#17365D',
//   navy700: '#285580',
//   navy500: '#4F8CCF',

//   // Soft teal
//   teal500: '#73B9D4',
//   teal100: '#E8F7FC',

//   // Primary: pastel blue identity
//   primaryLight: '#B8DCFA',
//   primary: '#7BADE8',
//   primaryDark: '#17365D',
//   primaryTint: '#EAF5FF',

//   // Active tabs, selected items and links
//   accent: '#4F8CCF',

//   // Complementary accents
//   sky: '#B8DCFA',
//   violet: '#C5B6E8',
//   coral: '#F6B7C5',
//   sunset: '#FFDCCB',

//   // Warm neutral backgrounds
//   white: '#FFFFFF',
//   background: '#FAF8F5',
//   surface: '#FFFFFF',
//   border: '#EEEAE6',

//   // Text
//   textPrimary: '#17324D',
//   textSecondary: '#607D99',
//   textInverse: '#FFFFFF',

//   // Status
//   success: '#3B9B79',
//   warning: '#C98A1C',
//   danger: '#C94B3F',

//   // Glass surfaces
//   glassSurface: 'rgba(255, 255, 255, 0.78)',
//   glassSurfaceStrong: 'rgba(255, 255, 255, 0.55)',
//   glassSurfaceStrongMatch: 'rgba(255, 255, 255, 0.75)',
//   glassBorder: 'rgba(255, 255, 255, 0.80)',
// };

// export const gradients = {
//   // Soft blue, lavender and peach
//   hero: ['#B8DCFA', '#DCEBFA', '#F4E6EE', '#FFDCCB'] as const,

//   // Strong navy buttons for readability
//   primaryButton: ['#285580', '#17365D'] as const,

//   // Neutral background across app screens
//   screen: ['#FAF8F5', '#FFFFFF', '#F7F5F2'] as const,

//   // Warm welcome screen
//   welcomeSky: ['#F3F8FF', '#FAF8F5', '#FFF1E8'] as const,
// };

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
  wordmark: 'LobsterTwo_700Bold_Italic',
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
    // shadowColor: '#0B2545',
    // shadowOffset: { width: 0, height: 4 },
    // shadowOpacity: 0.06,
    // shadowRadius: 12,
    // elevation: 5,
    shadowColor: '#17365D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    // elevation: 1,
  },
};
