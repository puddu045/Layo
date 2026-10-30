import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { RoomMessage } from '@layo/contracts';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ErrorState, LoadingState } from '../../src/components/StateViews';
import {
  useRealtimeRoomMessages,
  useRoomMessages,
  useSendRoomMessage,
} from '../../src/hooks/airport-room-hooks';
import { useReportContent } from '../../src/hooks/safety-hooks';
import { useAuth } from '../../src/lib/auth-context';
import { notifyConfirm, notifyInfo } from '../../src/lib/notify';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

export default function AirportRoomScreen() {
  const { iata } = useLocalSearchParams<{ iata: string }>();
  const airportIata = iata?.toUpperCase();
  const { session } = useAuth();
  useRealtimeRoomMessages(airportIata);

  const messages = useRoomMessages(airportIata);
  const sendMessage = useSendRoomMessage(airportIata ?? '');
  const reportContent = useReportContent();

  const [draft, setDraft] = useState('');

  const items = messages.data?.pages.flatMap((p) => p.items) ?? [];

  const onSend = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    sendMessage.mutate(body, {
      onError: (err) => notifyInfo('Could not send', err instanceof Error ? err.message : 'Please try again.'),
    });
  };

  const onReport = (message: RoomMessage) => {
    notifyConfirm(
      'Report this message?',
      `Report ${message.senderDisplayName}'s message to moderators for review.`,
      () => {
        reportContent.mutate(
          { reportedRoomMessageId: message.id, reason: 'OTHER' },
          {
            onSuccess: () => notifyInfo('Reported', 'Thanks — our team will review it.'),
            onError: (err) => notifyInfo('Could not report', err instanceof Error ? err.message : 'Please try again.'),
          },
        );
      },
      { confirmLabel: 'Report', destructive: true },
    );
  };

  return (
    <ScreenContainer style={{ paddingHorizontal: 0 }}>
      <Stack.Screen options={{ title: airportIata ? `${airportIata} Airport Chat` : 'Airport Chat' }} />

      {messages.isLoading ? (
        <LoadingState label="Loading room…" />
      ) : messages.isError ? (
        <ErrorState
          message={messages.error instanceof Error ? messages.error.message : 'Could not load this room'}
          onRetry={() => messages.refetch()}
        />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}
        >
          <FlatList
            inverted
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <RoomMessageBubble
                message={item}
                isMine={item.senderId === session?.user.id}
                onLongPress={() => onReport(item)}
              />
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No messages yet — say hello!</Text>}
            ListFooterComponent={
              messages.hasNextPage ? (
                <Pressable onPress={() => messages.fetchNextPage()} style={styles.loadOlder}>
                  <Text style={styles.loadOlderText}>
                    {messages.isFetchingNextPage ? 'Loading…' : 'Load older messages'}
                  </Text>
                </Pressable>
              ) : undefined
            }
          />

          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Message the room…"
              placeholderTextColor={colors.textSecondary}
              multiline
            />
            <Pressable
              style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
              onPress={onSend}
              disabled={!draft.trim() || sendMessage.isPending}
            >
              <Ionicons name="send" size={18} color={colors.white} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </ScreenContainer>
  );
}

function RoomMessageBubble({
  message,
  isMine,
  onLongPress,
}: {
  message: RoomMessage;
  isMine: boolean;
  onLongPress: () => void;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return (
    <Pressable onLongPress={onLongPress} style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      {!isMine && <Text style={styles.senderName}>{message.senderDisplayName}</Text>}
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{message.body}</Text>
      </View>
      <Text style={styles.bubbleTime}>{time}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexGrow: 1 },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
    transform: [{ scaleY: -1 }],
  },
  loadOlder: { alignItems: 'center', paddingVertical: spacing.md, transform: [{ scaleY: -1 }] },
  loadOlderText: { ...typography.caption, color: colors.teal500, fontWeight: '600' },
  bubbleRow: { marginBottom: spacing.sm, maxWidth: '80%' },
  bubbleRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleRowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderName: { ...typography.caption, color: colors.teal500, fontWeight: '600', marginBottom: 2, marginLeft: spacing.xs },
  bubble: { borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleMine: { backgroundColor: colors.navy900, borderBottomRightRadius: radius.sm },
  bubbleTheirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: radius.sm },
  bubbleText: { ...typography.body, color: colors.textPrimary },
  bubbleTextMine: { color: colors.white },
  bubbleTime: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.navy900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
});
