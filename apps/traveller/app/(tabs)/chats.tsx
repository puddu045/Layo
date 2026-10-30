import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Connection } from '@layo/contracts';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateViews';
import {
  useAcceptConnection,
  useConnections,
  useDeclineConnection,
  useRealtimeMessages,
} from '../../src/hooks/chat-hooks';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

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
          message={connections.error instanceof Error ? connections.error.message : 'Could not load chats'}
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
          <Text style={styles.title}>Chats</Text>
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Chats</Text>

        {requests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Requests</Text>
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
          </View>
        )}

        {accepted.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Messages</Text>
            {accepted.map((c) => (
              <ConnectionRow key={c.id} connection={c} />
            ))}
          </View>
        )}

        {sent.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Sent requests</Text>
            {sent.map((c) => (
              <Card key={c.id} style={styles.requestCard}>
                <Text style={styles.name}>{c.otherProfile.displayName}</Text>
                <Text style={styles.bio}>Waiting for them to respond</Text>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function ConnectionRow({ connection }: { connection: Connection }) {
  return (
    <Pressable onPress={() => router.push(`/chat/${connection.id}`)}>
      <Card style={styles.rowCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{connection.otherProfile.displayName.charAt(0).toUpperCase()}</Text>
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
  scroll: { paddingVertical: spacing.md, paddingBottom: spacing.xl },
  header: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.display, color: colors.navy900, marginBottom: spacing.md },
  section: { marginBottom: spacing.lg },
  sectionLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  requestCard: { marginBottom: spacing.sm },
  requestActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  rowCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.navy900,
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
    backgroundColor: colors.teal500,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
});
