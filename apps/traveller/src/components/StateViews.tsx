import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';
import { Button } from './Button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.navy900} size="large" />
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.caption}>{message}</Text>
      {onRetry ? (
        <View style={{ marginTop: spacing.md, minWidth: 160 }}>
          <Button label="Try again" onPress={onRetry} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.caption}>{description}</Text>
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.md, minWidth: 160 }}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

export function ComingSoonState({ feature }: { feature: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>{feature} is coming soon</Text>
      <Text style={styles.caption}>
        We&apos;re building this next. The groundwork — data model and API — is already in place.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  title: { ...typography.subtitle, color: colors.textPrimary, marginBottom: spacing.xs, textAlign: 'center' },
  caption: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
