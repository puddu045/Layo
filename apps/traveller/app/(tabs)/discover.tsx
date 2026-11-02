import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { MatchCategory } from '@layo/contracts';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { MatchCard } from '../../src/components/MatchCard';
import { Chip } from '../../src/components/Chip';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateViews';
import { useDiscover, useJourneys } from '../../src/hooks/api-hooks';
import { useCreateConnection } from '../../src/hooks/chat-hooks';
import { useUnreadNotificationsCount } from '../../src/hooks/notification-hooks';
import { notifyInfo } from '../../src/lib/notify';
import { colors, spacing, typography } from '../../src/theme/tokens';

const FILTERS: Array<{ label: string; value: MatchCategory | undefined; icon: keyof typeof Ionicons.glyphMap }> = [
  { label: 'All', value: undefined, icon: 'apps-outline' },
  { label: 'Same flight', value: 'SAME_FLIGHT', icon: 'airplane-outline' },
  { label: 'Departure airport', value: 'SAME_DEPARTURE_AIRPORT', icon: 'location-outline' },
  { label: 'Layover', value: 'SAME_LAYOVER_AIRPORT', icon: 'swap-horizontal-outline' },
];

export default function Discover() {
  const [category, setCategory] = useState<MatchCategory | undefined>(undefined);
  const journeys = useJourneys();
  const discover = useDiscover({ category, page: 1, pageSize: 20 });
  const createConnection = useCreateConnection();
  const unreadCount = useUnreadNotificationsCount();

  const onConnect = (userId: string) => {
    createConnection.mutate(userId, {
      onSuccess: (connection) => {
        notifyInfo(
          connection.status === 'ACCEPTED' ? 'Connected!' : 'Request sent',
          connection.status === 'ACCEPTED'
            ? 'You are now connected — find the chat in your Chats tab.'
            : "They'll see your request in their Chats tab.",
        );
      },
      onError: (err) => {
        notifyInfo(
          'Could not send request',
          err instanceof Error ? err.message : 'Please try again.',
        );
      },
    });
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Discover</Text>
          <View style={styles.subtitleRow}>
            <Ionicons name="people-outline" size={14} color={colors.primary} />
            <Text style={styles.subtitle}>Find travellers around your journey</Text>
          </View>
        </View>
        <View style={styles.headerIcons}>
          <Link href="/notifications" asChild>
            <Pressable hitSlop={8} style={styles.iconButton}>
              <Ionicons name="notifications-outline" size={22} color={colors.navy900} />
              {!!unreadCount.data && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount.data > 9 ? '9+' : unreadCount.data}
                  </Text>
                </View>
              )}
            </Pressable>
          </Link>
          <Link href="/settings" asChild>
            <Pressable hitSlop={8}>
              <Ionicons name="settings-outline" size={22} color={colors.navy900} />
            </Pressable>
          </Link>
        </View>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Chip
            key={f.label}
            label={f.label}
            icon={f.icon}
            selected={category === f.value}
            onPress={() => setCategory(f.value)}
          />
        ))}
      </View>

      {discover.isLoading ? (
        <LoadingState label="Finding travellers near you…" />
      ) : discover.isError ? (
        <ErrorState
          message={
            discover.error instanceof Error ? discover.error.message : 'Could not load matches'
          }
          onRetry={() => discover.refetch()}
        />
      ) : !journeys.data || journeys.data.length === 0 ? (
        <EmptyState
          title="Add a journey to start discovering"
          description="Once you add an upcoming flight, we'll show you travellers on the same flight, departure airport or layover."
          actionLabel="Add a flight"
          onAction={() => router.push('/journeys/new')}
        />
      ) : discover.data && discover.data.items.length > 0 ? (
        <FlatList
          data={discover.data.items}
          keyExtractor={(item, index) => `${item.category}-${item.profile.userId}-${index}`}
          renderItem={({ item }) => (
            <MatchCard match={item} onConnect={() => onConnect(item.profile.userId)} />
          )}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          // No pull-to-refresh: react-native-web has no real gesture for it, and on Android a
          // RefreshControl stuck mid-state (e.g. a background refetch) renders as a stray circle
          // sitting over the list — not worth it when every screen already refetches on focus.
        />
      ) : (
        <EmptyState
          title="No travellers found yet"
          description="We couldn't find anyone matching your upcoming journeys right now. Check back closer to your travel date."
        />
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
  title: { ...typography.display, color: colors.primaryDark },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconButton: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
});
