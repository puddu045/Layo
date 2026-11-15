import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { BRAND } from '@layo/config';

// Matches the shipped PNG's own cropped aspect ratio — an explicit width/height, not just
// resizeMode="contain" on an unsized box, so layout has a real size to work with before the
// image itself has necessarily loaded. The current asset is the "Layo" script plus the cloud
// mark, side by side (a wide, short lockup) rather than the taller cursive-only wordmark before.
const ASPECT_RATIO = 1982 / 659;

/** The "Layo" wordmark (script + cloud mark), pre-rendered to a single image
 * (`layo-wordmark.png`) rather than live Text — see `welcome.tsx`'s git history for why: a
 * script font's loops and swashes clip against native's stricter text-rendering box in a way no
 * amount of outer padding fixed, and a plain image has no font-metric box to clip against on any
 * platform. Shared by every screen that shows the wordmark (welcome, login, register) so they
 * can't drift out of sync with each other. */
export function Wordmark({ width = 220, style }: { width?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={require('../../assets/images/layo-wordmark.png')}
      style={[{ width, height: width / ASPECT_RATIO }, style]}
      resizeMode="contain"
      accessibilityLabel={BRAND.name}
    />
  );
}
