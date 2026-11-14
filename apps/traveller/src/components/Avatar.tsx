import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/tokens';

/** Width ÷ height of the "airplane window" shape every avatar in the app uses — a touch
 * narrower than tall, like a real cabin window, not a square or a circle. The crop tool
 * (`AvatarCropModal`) shares this exact ratio so what you crop is what you see everywhere else. */
export const AVATAR_ASPECT_RATIO = 0.8;

interface AvatarProps {
  photoUrl?: string;
  displayName: string;
  /** The shape's height in px; width is derived from `AVATAR_ASPECT_RATIO`. */
  size?: number;
  /** 'icon' (default): a generic person silhouette when there's no photo — used everywhere
   * this app shows a person without necessarily knowing their name is relevant context (the top
   * bar, the profile page). 'initial' falls back to the display name's first letter instead —
   * used in the 1:1 chat screen specifically, where the name is already front and centre. */
  fallback?: 'icon' | 'initial';
  style?: StyleProp<ViewStyle>;
}

/** This app's signature shape: every photo (or its fallback) renders in a rounded "airplane
 * window" frame instead of a plain circle. */
export function Avatar({ photoUrl, displayName, size = 40, fallback = 'icon', style }: AvatarProps) {
  const width = Math.round(size * AVATAR_ASPECT_RATIO);
  const dimensionStyle = { width, height: size, borderRadius: width / 2 };

  if (photoUrl) {
    return (
      <View style={[styles.frame, dimensionStyle, style]}>
        <Image source={{ uri: photoUrl }} style={[styles.image, dimensionStyle as StyleProp<ImageStyle>]} />
      </View>
    );
  }

  if (fallback === 'initial') {
    const initial = displayName.trim().charAt(0).toUpperCase() || '?';
    return (
      <View style={[styles.frame, styles.initialFallback, dimensionStyle, style]}>
        <Text style={[styles.initialText, { fontSize: size * 0.4 }]}>{initial}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.frame, styles.iconFallback, dimensionStyle, style]}>
      <Ionicons name="person" size={size * 0.52} color={colors.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  // The frame carries the border so it reads identically whether a photo or a fallback fills
  // it — a translucent/solid border on the photo variant alone would look like a seam instead
  // of a window edge.
  // No shadow here: `overflow: 'hidden'` (needed to actually clip the photo to the window
  // shape) also clips any shadow on the same view on iOS, and a shadowColor/Offset/Opacity
  // shadow like this app's `shadow.card` never renders on Android without `elevation` anyway
  // — so one would render on neither platform. The border alone carries the window's edge.
  frame: {
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { backgroundColor: colors.border },
  initialFallback: { backgroundColor: colors.primaryDark },
  initialText: { color: colors.white, fontWeight: '700' },
  iconFallback: { backgroundColor: colors.primaryTint },
});
