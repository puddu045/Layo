import { StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassBackground } from './GlassBackground';
import { colors, spacing } from '../theme/tokens';

interface ScreenContainerProps extends ViewProps {
  /** Passed through to `GlassBackground` — "bold" is for screens with no dense text to protect
   * (currently just the welcome screen). */
  backgroundVariant?: 'default' | 'bold';
}

export function ScreenContainer({ style, children, backgroundVariant, ...rest }: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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
