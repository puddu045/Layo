import { useEffect, useState } from 'react';
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
import type { Message } from '@layo/contracts';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ErrorState, LoadingState } from '../../src/components/StateViews';
import {
  useConnections,
  useMarkRead,
  useMessages,
  useRealtimeMessages,
  useSendMessage,
} from '../../src/hooks/chat-hooks';
import { useAuth } from '../../src/lib/auth-context';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

export default function ChatScreen() {
  const { connectionId } = useLocalSearchParams<{ connectionId: string }>();
  const { session } = useAuth();
  useRealtimeMessages();

  const connections = useConnections();
  const connection = connections.data?.find((c) => c.id === connectionId);

  const messages = useMessages(connectionId);
  const sendMessage = useSendMessage(connectionId ?? '');
  const markRead = useMarkRead(connectionId ?? '');

  const [draft, setDraft] = useState('');

  // Intentionally depends only on connectionId: mark read once per opened
  // conversation, not on every re-render `markRead` identity changes.
  useEffect(() => {
    if (connectionId) markRead.mutate();
  }, [connectionId]);

  const onSend = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    sendMessage.mutate(body);
  };

  return (
    <ScreenContainer style={{ paddingHorizontal: 0 }}>
      <Stack.Screen options={{ title: connection?.otherProfile.displayName ?? 'Chat' }} />

      {messages.isLoading ? (
        <LoadingState label="Loading messages…" />
      ) : messages.isError ? (
        <ErrorState
          message={messages.error instanceof Error ? messages.error.message : 'Could not load messages'}
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
            data={messages.data?.items ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => <MessageBubble message={item} isMine={item.senderId === session?.user.id} />}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No messages yet — say hello!</Text>
            }
          />

          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Message…"
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

function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  const time = new Date(message.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{message.body}</Text>
      </View>
      <Text style={styles.bubbleTime}>{time}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexGrow: 1 },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
    transform: [{ scaleY: -1 }], // list is inverted; flip the empty-state text back upright
  },
  bubbleRow: { marginBottom: spacing.sm, maxWidth: '80%' },
  bubbleRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleRowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
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
