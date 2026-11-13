import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Connection } from '@layo/contracts';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { TopBarIcons } from '../../src/components/TopBarIcons';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateViews';
import {
  useAcceptConnection,
  useConnections,
  useDeclineConnection,
  useRealtimeMessages,
} from '../../src/hooks/chat-hooks';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

type Tab = 'messages' | 'requests';

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function Chats() {
  useRealtimeMessages();
  const [tab, setTab] = useState<Tab>('messages');

  const connections = useConnections();
  const acceptConnection = useAcceptConnection();
  const declineConnection = useDeclineConnection();

  if (connections.isLoading) {
    return (
      <ScreenContainer>
        <LoadingState label="Loading your connections…" />
      </ScreenContainer>
    );
  }

  if (connections.isError) {
    return (
      <ScreenContainer>
        <ErrorState
          message={
            connections.error instanceof Error ? connections.error.message : 'Could not load chats'
          }
          onRetry={() => connections.refetch()}
        />
      </ScreenContainer>
    );
  }

  const all = connections.data ?? [];
  const requests = all.filter((c) => c.status === 'PENDING' && c.direction === 'RECEIVED');
  const sent = all.filter((c) => c.status === 'PENDING' && c.direction === 'SENT');
  const accepted = all
    .filter((c) => c.status === 'ACCEPTED')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  if (all.length === 0) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Chats</Text>
            <Text style={styles.subtitle}>Your conversations and connection requests</Text>
          </View>
          <TopBarIcons />
        </View>
        <EmptyState
          title="No connections yet"
          description="Send a connection request from Discover to start chatting with fellow travellers."
          actionLabel="Go to Discover"
          onAction={() => router.push('/(tabs)/discover')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Chats</Text>
          <Text style={styles.subtitle}>Your conversations and connection requests</Text>
        </View>
        <TopBarIcons />
      </View>

      <View style={styles.tabs}>
        <TabButton label="Messages" active={tab === 'messages'} onPress={() => setTab('messages')} />
        <TabButton
          label="Requests"
          count={requests.length}
          active={tab === 'requests'}
          onPress={() => setTab('requests')}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {tab === 'messages' &&
          (accepted.length > 0 ? (
            accepted.map((c) => <ConnectionRow key={c.id} connection={c} />)
          ) : (
            <Text style={styles.emptyTabText}>No conversations yet — accept a request to start chatting.</Text>
          ))}

        {tab === 'requests' && (
          <>
            {requests.map((c) => (
              <Card key={c.id} style={styles.requestCard}>
                <Text style={styles.name}>
                  {c.otherProfile.displayName}
                  {c.otherProfile.age ? `, ${c.otherProfile.age}` : ''}
                </Text>
                {c.otherProfile.bio ? <Text style={styles.bio}>{c.otherProfile.bio}</Text> : null}
                <View style={styles.requestActions}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Accept"
                      onPress={() => acceptConnection.mutate(c.id)}
                      loading={acceptConnection.isPending}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Decline"
                      variant="ghost"
                      onPress={() => declineConnection.mutate(c.id)}
                      loading={declineConnection.isPending}
                    />
                  </View>
                </View>
              </Card>
            ))}

            {sent.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Sent</Text>
                {sent.map((c) => (
                  <Card key={c.id} style={styles.requestCard}>
                    <Text style={styles.name}>{c.otherProfile.displayName}</Text>
                    <Text style={styles.bio}>Waiting for them to respond</Text>
                  </Card>
                ))}
              </>
            )}

            {requests.length === 0 && sent.length === 0 && (
              <Text style={styles.emptyTabText}>No pending requests.</Text>
            )}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function TabButton({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      {!!count && (
        <View style={[styles.tabCount, active && styles.tabCountActive]}>
          <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

function ConnectionRow({ connection }: { connection: Connection }) {
  return (
    <Pressable onPress={() => router.push(`/chat/${connection.id}`)}>
      <Card style={styles.rowCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {connection.otherProfile.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text style={styles.name}>{connection.otherProfile.displayName}</Text>
            {connection.lastMessage && (
              <Text style={styles.time}>{formatTime(connection.lastMessage.createdAt)}</Text>
            )}
          </View>
          <Text style={styles.preview} numberOfLines={1}>
            {connection.lastMessage?.body ?? 'Say hello!'}
          </Text>
        </View>
        {connection.unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{connection.unreadCount}</Text>
          </View>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing.sm, paddingBottom: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { ...typography.display, color: colors.primaryDark },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.primaryTint,
    borderRadius: radius.pill,
    padding: 4,
    marginTop: spacing.sm,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  tabButtonActive: { backgroundColor: colors.primary },
  tabLabel: { ...typography.body, color: colors.navy700, fontWeight: '600' },
  tabLabelActive: { color: colors.white },
  tabCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabCountActive: { backgroundColor: colors.white },
  tabCountText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  tabCountTextActive: { color: colors.primary },
  emptyTabText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
  sectionLabel: { ...typography.label, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm },
  requestCard: { marginBottom: spacing.sm },
  requestActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, ...typography.subtitle },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { ...typography.subtitle, color: colors.textPrimary },
  bio: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  time: { ...typography.caption, color: colors.textSecondary },
  preview: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
});
