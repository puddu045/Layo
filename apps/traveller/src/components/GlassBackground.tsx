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
 */
export function GlassBackground() {
  return (
    <LinearGradient
      colors={gradients.screen}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
