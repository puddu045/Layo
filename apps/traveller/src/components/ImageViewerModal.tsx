import { Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AVATAR_ASPECT_RATIO } from './Avatar';
import { colors, radius, spacing } from '../theme/tokens';

interface ImageViewerModalProps {
  photoUrl: string | undefined;
  onClose: () => void;
  /** Shows a camera button over the bottom-right of the frame when provided, for the signed-in
   * user's own photo — tapping it closes the viewer and hands off to whatever picks a new one.
   * Omitted when viewing someone else's photo, which is view-only. */
  onChangePhoto?: () => void;
}

/** The enlarged view behind tapping a profile picture — this app's "airplane window" shape,
 * just much bigger, so it reads as the same photo rather than a different kind of popup.
 * Visible exactly when `photoUrl` is set; tapping anywhere outside the frame closes it. */
export function ImageViewerModal({ photoUrl, onClose, onChangePhoto }: ImageViewerModalProps) {
  const { width, height } = useWindowDimensions();
  const frameWidth = Math.min(width * 0.75, height * 0.6 * AVATAR_ASPECT_RATIO, 340);
  const frameHeight = frameWidth / AVATAR_ASPECT_RATIO;

  return (
    <Modal visible={!!photoUrl} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={24} color={colors.white} />
        </Pressable>

        {/* Swallows the tap so it doesn't bubble to the backdrop and close the viewer. */}
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={styles.frameWrap}>
            <View
              style={[
                styles.frame,
                { width: frameWidth, height: frameHeight, borderRadius: frameWidth / 2 },
              ]}
            >
              {photoUrl && <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} />}
            </View>
            {onChangePhoto && (
              <Pressable
                style={styles.changeButton}
                onPress={() => {
                  onClose();
                  onChangePhoto();
                }}
              >
                <Ionicons name="camera" size={20} color={colors.white} />
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 20, 33, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameWrap: { position: 'relative' },
  frame: { backgroundColor: colors.navy900, borderWidth: 2, borderColor: colors.white, overflow: 'hidden' },
  changeButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
});
