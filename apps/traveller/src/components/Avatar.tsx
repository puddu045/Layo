import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/tokens';

interface AvatarProps {
  photoUrl?: string;
  displayName: string;
  size?: number;
  /** 'icon' (default): a generic person silhouette when there's no photo — used everywhere
   * this app shows a person without necessarily knowing their name is relevant context (the top
   * bar, the profile page). 'initial' falls back to the display name's first letter instead —
   * used in the 1:1 chat screen specifically, where the name is already front and centre. */
  fallback?: 'icon' | 'initial';
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ photoUrl, displayName, size = 40, fallback = 'icon', style }: AvatarProps) {
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (photoUrl) {
    return (
      <Image source={{ uri: photoUrl }} style={[styles.image, dimensionStyle, style as StyleProp<ImageStyle>]} />
    );
  }

  if (fallback === 'initial') {
    const initial = displayName.trim().charAt(0).toUpperCase() || '?';
    return (
      <View style={[styles.initialFallback, dimensionStyle, style]}>
        <Text style={[styles.initialText, { fontSize: size * 0.42 }]}>{initial}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.iconFallback, dimensionStyle, style]}>
      <Ionicons name="person" size={size * 0.56} color={colors.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.border },
  initialFallback: { backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: colors.white, fontWeight: '700' },
  iconFallback: { backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
});
