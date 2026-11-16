import { StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassBackground } from './GlassBackground';
import { colors, spacing } from '../theme/tokens';

interface ScreenContainerProps extends ViewProps {
  /** Passed through to `GlassBackground` — "bold" is for screens with no dense text to protect
   * (currently just the welcome screen). */
  backgroundVariant?: 'default' | 'bold';
  /** Screens pushed with `headerShown: true` (Settings, Chat, journeys, Airport Chat,
   * profile-setup) already get the top safe-area inset consumed by the native header itself —
   * reserving it again here stacked a second, visually identical peach gap underneath the
   * header. Set this on those screens so only `left`/`right` get reserved. */
  hasNativeHeader?: boolean;
}

export function ScreenContainer({ style, children, backgroundVariant, hasNativeHeader, ...rest }: ScreenContainerProps) {
  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={hasNativeHeader ? ['left', 'right'] : ['top', 'left', 'right']}
    >
      <GlassBackground variant={backgroundVariant} />
      <View style={[styles.container, style]} {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.lg },
});
