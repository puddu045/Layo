import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../theme/tokens';

/**
 * The soft colour wash every screen sits on, so glass cards (`Card`,
 * `BlurView`-backed) actually read as glass — translucency only shows up
 * against something with colour behind it, not flat white. One smooth
 * diagonal gradient, not scattered blobs: it needs to stay even enough that
 * a BlurView card blurring it never looks patchy. Absolutely positioned
 * behind `ScreenContainer`'s content, non-interactive.
 *
 * `variant="bold"` swaps in the more saturated lavender → pink → peach sky
 * used on the welcome screen — it has no dense text to protect, unlike
 * every other screen, which stays on the paler default.
 */
export function GlassBackground({ variant = 'default' }: { variant?: 'default' | 'bold' }) {
  return (
    <LinearGradient
      colors={variant === 'bold' ? gradients.welcomeSky : gradients.screen}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
