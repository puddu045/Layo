/**
 * Design tokens for the traveller app. A restrained navy / white / teal
 * palette, generous spacing, and a small type scale — kept in one place so
 * the "premium travel" look stays consistent across every screen.
 */
export const colors = {
  navy900: '#0B2545',
  navy700: '#13335C',
  navy500: '#1D4E89',
  teal500: '#1FA2A6',
  teal100: '#E3F6F5',
  white: '#FFFFFF',
  background: '#F7F9FC',
  surface: '#FFFFFF',
  border: '#E3E8F0',
  textPrimary: '#0F1A2B',
  textSecondary: '#5A6B85',
  textInverse: '#FFFFFF',
  success: '#2F9E5B',
  warning: '#C98A1C',
  danger: '#C94B3F',
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

export const typography = {
  display: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  title: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  subtitle: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600' as const, lineHeight: 16 },
};

export const shadow = {
  card: {
    shadowColor: '#0B2545',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
};
