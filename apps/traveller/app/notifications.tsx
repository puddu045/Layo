import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Notification } from '@layo/contracts';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { EmptyState, ErrorState, LoadingState } from '../src/components/StateViews';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useRealtimeNotifications,
} from '../src/hooks/notification-hooks';
import { colors, radius, spacing, typography } from '../src/theme/tokens';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function describe(n: Notification): { title: string; body: string; onPress?: () => void } {
  switch (n.type) {
    case 'CONNECTION_REQUEST':
      return {
        title: 'New connection request',
        body: "Check your Chats tab to accept or decline.",
        onPress: () => router.push('/(tabs)/chats'),
      };
    case 'CONNECTION_ACCEPTED':
      return {
        title: 'Connection accepted',
        body: "You're now connected — say hello in Chats.",
        onPress: () => router.push('/(tabs)/chats'),
      };
    case 'BUSINESS_STATUS_CHANGED': {
      const status = String(n.payload.status ?? '');
      return {
        title: `Business ${status.toLowerCase()}`,
        body:
          status === 'APPROVED'
            ? 'Your business was approved — you can now submit deals from the business portal.'
            : `Your business status changed to ${status.toLowerCase()}.`,
      };
    }
    case 'DEAL_STATUS_CHANGED': {
      const status = String(n.payload.status ?? '');
      const reason = n.payload.rejectionReason ? ` (${String(n.payload.rejectionReason)})` : '';
      return {
        title: `Deal ${status.toLowerCase()}`,
        body: status === 'APPROVED' ? 'Your deal is now live for travellers.' : `Your deal was rejected${reason}.`,
      };
    }
    default:
      return { title: n.type, body: '' };
  }
}

export default function Notifications() {
  useRealtimeNotifications();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = notifications.data?.pages.flatMap((page) => page.items) ?? [];
  const hasUnread = items.some((n) => !n.readAt);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {hasUnread && (
          <Pressable onPress={() => markAllRead.mutate()} hitSlop={8}>
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {notifications.isLoading ? (
        <LoadingState label="Loading notifications…" />
      ) : notifications.isError ? (
        <ErrorState
          message={notifications.error instanceof Error ? notifications.error.message : 'Could not load notifications'}
          onRetry={() => notifications.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="Connection requests, and updates about any business or deal you submit, will show up here."
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
          {items.map((n) => {
            const { title, body, onPress } = describe(n);
            const card = (
              <Card style={[styles.card, n.readAt && styles.cardRead]}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{title}</Text>
                  {!n.readAt && <View style={styles.dot} />}
                </View>
                {body ? <Text style={styles.cardBody}>{body}</Text> : null}
                <Text style={styles.cardWhen}>{formatWhen(n.createdAt)}</Text>
              </Card>
            );
            return (
              <Pressable
                key={n.id}
                onPress={() => {
                  if (!n.readAt) markRead.mutate(n.id);
                  onPress?.();
                }}
              >
                {card}
              </Pressable>
            );
          })}
          {notifications.hasNextPage && (
            <Button
              label={notifications.isFetchingNextPage ? 'Loading…' : 'Load older'}
              variant="secondary"
              onPress={() => notifications.fetchNextPage()}
              loading={notifications.isFetchingNextPage}
            />
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { ...typography.display, color: colors.navy900 },
  markAll: { ...typography.caption, color: colors.teal500, fontWeight: '600' },
  card: { marginBottom: spacing.sm },
  cardRead: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...typography.subtitle, color: colors.textPrimary, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: radius.sm, backgroundColor: colors.teal500 },
  cardBody: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  cardWhen: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
});
