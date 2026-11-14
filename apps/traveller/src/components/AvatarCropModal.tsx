import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AVATAR_ASPECT_RATIO } from './Avatar';
import { Button } from './Button';
import { cropImage } from '../lib/crop-image';
import { colors, radius, spacing, typography } from '../theme/tokens';

const VIEWPORT_HEIGHT = 280;
const VIEWPORT_WIDTH = Math.round(VIEWPORT_HEIGHT * AVATAR_ASPECT_RATIO);
const OUTPUT_WIDTH = 480;
const MAX_ZOOM = 3;

interface AvatarCropModalProps {
  /** The just-picked image's uri; the modal is visible exactly when this is set. */
  uri: string | undefined;
  onCancel: () => void;
  onConfirm: (croppedUri: string) => void;
}

/**
 * The upload flow's crop step: pan the photo behind a fixed window-shaped viewport (the same
 * shape `Avatar` renders everywhere — see `AVATAR_ASPECT_RATIO`) and zoom in, then confirm to
 * crop+resize it to exactly what's visible. Drag uses `PanResponder` (core React Native, no
 * extra gesture library) rather than pinch-to-zoom, which needs `react-native-gesture-handler` —
 * a new native dependency that would need its own EAS build; the +/- buttons cover zoom instead.
 */
export function AvatarCropModal({ uri, onCancel, onConfirm }: AvatarCropModalProps) {
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | undefined>();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [cropping, setCropping] = useState(false);
  const offsetAtGestureStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!uri) {
      setImageSize(undefined);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      return;
    }
    Image.getSize(
      uri,
      (width, height) => setImageSize({ width, height }),
      () => setImageSize(undefined),
    );
  }, [uri]);

  // "Cover" scale: the smallest scale at which the image fully fills the viewport in both
  // dimensions — the floor for zoom, since anything smaller would leave empty space showing.
  const coverScale = imageSize
    ? Math.max(VIEWPORT_WIDTH / imageSize.width, VIEWPORT_HEIGHT / imageSize.height)
    : 1;
  const scale = coverScale * zoom;
  const renderedSize = imageSize ? { width: imageSize.width * scale, height: imageSize.height * scale } : undefined;

  const clampOffset = (candidate: { x: number; y: number }) => {
    if (!renderedSize) return candidate;
    const minX = Math.min(0, VIEWPORT_WIDTH - renderedSize.width);
    const minY = Math.min(0, VIEWPORT_HEIGHT - renderedSize.height);
    return { x: Math.min(0, Math.max(minX, candidate.x)), y: Math.min(0, Math.max(minY, candidate.y)) };
  };

  // Re-clamp whenever zoom (or the image itself) changes the image's rendered size, so a zoom-out
  // can't leave the pan sitting somewhere that would now show empty space past the image's edge.
  useEffect(() => {
    setOffset((prev) => clampOffset(prev));
    // (clampOffset reads `renderedSize`, which is derived straight from `zoom`/`imageSize` on
    // every render, so depending on those two is equivalent to depending on it directly.)
  }, [zoom, imageSize]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
        onPanResponderGrant: () => {
          offsetAtGestureStart.current = offset;
        },
        onPanResponderMove: (_, gesture) => {
          setOffset(
            clampOffset({
              x: offsetAtGestureStart.current.x + gesture.dx,
              y: offsetAtGestureStart.current.y + gesture.dy,
            }),
          );
        },
      }),
    [offset, renderedSize],
  );

  const onConfirmPress = async () => {
    if (!uri || !imageSize || !renderedSize) return;
    setCropping(true);
    try {
      const rect = {
        originX: Math.round(-offset.x / scale),
        originY: Math.round(-offset.y / scale),
        width: Math.round(VIEWPORT_WIDTH / scale),
        height: Math.round(VIEWPORT_HEIGHT / scale),
      };
      const result = await cropImage(uri, rect, OUTPUT_WIDTH);
      onConfirm(result.uri);
    } finally {
      setCropping(false);
    }
  };

  return (
    <Modal visible={!!uri} transparent animationType="fade">
      <View style={styles.backdrop}>
        <Text style={styles.title}>Move and zoom to frame your photo</Text>

        <View style={styles.viewport}>
          {uri && imageSize && renderedSize && (
            <View {...panResponder.panHandlers} style={StyleSheet.absoluteFill}>
              <Image
                source={{ uri }}
                style={{
                  position: 'absolute',
                  left: offset.x,
                  top: offset.y,
                  width: renderedSize.width,
                  height: renderedSize.height,
                }}
              />
            </View>
          )}
        </View>

        <View style={styles.zoomRow}>
          <Pressable
            style={styles.zoomButton}
            onPress={() => setZoom((z) => Math.max(1, z - 0.25))}
            disabled={zoom <= 1}
          >
            <Ionicons name="remove" size={20} color={zoom <= 1 ? colors.textSecondary : colors.navy900} />
          </Pressable>
          <Pressable
            style={styles.zoomButton}
            onPress={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.25))}
            disabled={zoom >= MAX_ZOOM}
          >
            <Ionicons name="add" size={20} color={zoom >= MAX_ZOOM ? colors.textSecondary : colors.navy900} />
          </Pressable>
        </View>

        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <Button label="Cancel" variant="ghost" onPress={onCancel} disabled={cropping} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Use photo" onPress={onConfirmPress} loading={cropping} disabled={!imageSize} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 54, 93, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: { ...typography.body, color: colors.white, marginBottom: spacing.lg, textAlign: 'center' },
  viewport: {
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    borderRadius: VIEWPORT_WIDTH / 2,
    overflow: 'hidden',
    backgroundColor: colors.navy900,
    borderWidth: 2,
    borderColor: colors.white,
  },
  zoomRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  zoomButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl, width: '100%', maxWidth: 320 },
});
