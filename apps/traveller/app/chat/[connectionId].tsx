import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Message, ReportReason } from '@layo/contracts';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { Avatar } from '../../src/components/Avatar';
import { ProfilePreviewModal, connectionToMatchInfo } from '../../src/components/ProfilePreviewModal';
import { ErrorState, LoadingState } from '../../src/components/StateViews';
import { ReportReasonSheet } from '../../src/components/ReportReasonSheet';
import { MessageActionsSheet } from '../../src/components/MessageActionsSheet';
import {
  useConnections,
  useMarkRead,
  useMessages,
  useRealtimeMessages,
  useSendMessage,
} from '../../src/hooks/chat-hooks';
import { useBlockUser, useReportContent, useUnblockUser } from '../../src/hooks/safety-hooks';
import { useAuth } from '../../src/lib/auth-context';
import { ApiError } from '../../src/lib/api-client';
import { notifyConfirm, notifyInfo } from '../../src/lib/notify';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

export default function ChatScreen() {
  const { connectionId } = useLocalSearchParams<{ connectionId: string }>();
  const { session } = useAuth();
  useRealtimeMessages(connectionId);

  const connections = useConnections();
  const connection = connections.data?.find((c) => c.id === connectionId);

  const messages = useMessages(connectionId);
  const sendMessage = useSendMessage(connectionId ?? '');
  const markRead = useMarkRead(connectionId ?? '');
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const reportContent = useReportContent();

  const [draft, setDraft] = useState('');
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [actionsTarget, setActionsTarget] = useState<Message | undefined>(undefined);
  const [replyTo, setReplyTo] = useState<Message | undefined>(undefined);

  // The quoted preview (above the composer, and inside a reply bubble) only ever names "You" or
  // the other participant — this is a 1:1 conversation, so a quoted message's sender is always
  // one of exactly those two.
  const replySenderLabel = (senderId: string) =>
    senderId === session?.user.id ? 'You' : (connection?.otherProfile.displayName ?? 'them');

  const onBlock = () => {
    if (!connection) return;
    setReportSheetOpen(true);
  };

  const onConfirmBlock = (reason?: ReportReason) => {
    if (!connection) return;
    setReportSheetOpen(false);
    const name = connection.otherProfile.displayName;
    const userId = connection.otherProfile.userId;

    blockUser.mutate(userId, {
      onSuccess: () => notifyInfo('Blocked', `${name} has been blocked.`),
      onError: (err) => notifyInfo('Could not block', err instanceof Error ? err.message : 'Please try again.'),
    });

    // A failed report shouldn't look like the block itself failed — it already succeeded above,
    // independently — so this gets its own silent-ish failure rather than a second alert stacked
    // on top of the block's own success message.
    if (reason) {
      reportContent.mutate({ reportedUserId: userId, reason });
    }
  };

  const onUnblock = () => {
    if (!connection) return;
    unblockUser.mutate(connection.otherProfile.userId, {
      onSuccess: () => notifyInfo('Unblocked', `You can message ${connection.otherProfile.displayName} again.`),
      onError: (err) => notifyInfo('Could not unblock', err instanceof Error ? err.message : 'Please try again.'),
    });
  };

  const onReportMessage = (message: Message) => {
    notifyConfirm(
      'Report this message?',
      'Report it to moderators for review.',
      () => {
        reportContent.mutate(
          { reportedMessageId: message.id, reason: 'OTHER' },
          {
            onSuccess: () => notifyInfo('Reported', 'Thanks — our team will review it.'),
            onError: (err) => notifyInfo('Could not report', err instanceof Error ? err.message : 'Please try again.'),
          },
        );
      },
      { confirmLabel: 'Report', destructive: true },
    );
  };

  // Intentionally depends only on connectionId: mark read once per opened
  // conversation, not on every re-render `markRead` identity changes.
  useEffect(() => {
    if (connectionId) markRead.mutate();
  }, [connectionId]);

  const onSend = () => {
    const body = draft.trim();
    if (!body) return;
    const replying = replyTo;
    setDraft('');
    setReplyTo(undefined);
    sendMessage.mutate(
      { body, replyTo: replying },
      {
        // A block (by either side) makes send fail even though the composer was still showing —
        // e.g. the other person blocked this viewer moments ago. Put the draft (and the reply
        // target) back so neither is silently lost, and say so instead of the message just
        // vanishing with no explanation.
        onError: (err) => {
          setDraft(body);
          setReplyTo(replying);
          notifyInfo('Message not sent', err instanceof Error ? err.message : 'Please try again.');
        },
      },
    );
  };

  const blockedByOther = messages.error instanceof ApiError && messages.error.status === 403;
  const blockedByMe = connection?.blockedByMe ?? false;

  return (
    <ScreenContainer style={{ paddingHorizontal: 0 }}>
      <Stack.Screen
        options={{
          title: connection?.otherProfile.displayName ?? 'Chat',
          headerTitle: () => (
            <Pressable
              style={styles.headerTitle}
              onPress={() => setPreviewOpen(true)}
              disabled={!connection}
            >
              <Avatar
                photoUrl={connection?.otherProfile.photoUrl}
                displayName={connection?.otherProfile.displayName ?? '?'}
                size={30}
                fallback="initial"
              />
              <Text style={styles.headerTitleText} numberOfLines={1}>
                {connection?.otherProfile.displayName ?? 'Chat'}
              </Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={blockedByMe ? onUnblock : onBlock}
              hitSlop={8}
              style={{ paddingHorizontal: spacing.xs }}
            >
              <Ionicons
                name={blockedByMe ? 'shield' : 'shield-outline'}
                size={22}
                color={blockedByMe ? colors.danger : colors.navy900}
              />
            </Pressable>
          ),
        }}
      />

      {messages.isLoading ? (
        <LoadingState label="Loading messages…" />
      ) : messages.isError ? (
        <ErrorState
          message={
            blockedByOther
              ? 'This conversation is no longer available.'
              : messages.error instanceof Error
                ? messages.error.message
                : 'Could not load messages'
          }
          onRetry={blockedByOther ? undefined : () => messages.refetch()}
        />
      ) : (
        /* 'height' on Android, not undefined: this relied on windowSoftInputMode=adjustResize,
           which the project never actually configures in app.json (and which Expo Go's prebuilt
           manifest wouldn't pick up from app.json anyway) — 'height' handles it entirely in JS
           via the Keyboard module instead, so it doesn't depend on any native manifest setting. */
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={90}
        >
          {(messages.data?.items.length ?? 0) === 0 ? (
            // Rendered outside the inverted FlatList on purpose: a `ListEmptyComponent` sits
            // inside the list's own inverted layout, so a counter-transform to keep its text
            // upright can come out mirrored depending on platform. A plain, non-inverted view
            // has no inversion to counteract in the first place.
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No messages yet — say hello!</Text>
            </View>
          ) : (
            <FlatList
              inverted
              data={messages.data?.items ?? []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <MessageBubble
                  message={item}
                  isMine={item.senderId === session?.user.id}
                  resolveSenderLabel={replySenderLabel}
                  onLongPress={() => setActionsTarget(item)}
                  onSwipeReply={() => setReplyTo(item)}
                />
              )}
            />
          )}

          {blockedByMe ? (
            <View style={styles.blockedBar}>
              <Ionicons name="shield" size={18} color={colors.danger} />
              <Text style={styles.blockedText}>
                You&apos;ve blocked {connection?.otherProfile.displayName}.
              </Text>
              <Pressable onPress={onUnblock} hitSlop={8}>
                <Text style={styles.blockedAction}>Unblock</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              {replyTo && (
                <View style={styles.replyPreviewBar}>
                  <View style={styles.replyPreviewAccent} />
                  <View style={styles.replyPreviewText}>
                    <Text style={styles.replyPreviewLabel}>Replying to {replySenderLabel(replyTo.senderId)}</Text>
                    <Text style={styles.replyPreviewBody} numberOfLines={1}>
                      {replyTo.body}
                    </Text>
                  </View>
                  <Pressable onPress={() => setReplyTo(undefined)} hitSlop={8}>
                    <Ionicons name="close" size={18} color={colors.textSecondary} />
                  </Pressable>
                </View>
              )}
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
                  <Ionicons name="airplane" size={18} color={colors.white} style={styles.sendIcon} />
                </Pressable>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      )}

      <MessageActionsSheet
        visible={!!actionsTarget}
        canReport={!!actionsTarget && actionsTarget.senderId !== session?.user.id}
        onReply={() => {
          setReplyTo(actionsTarget);
          setActionsTarget(undefined);
        }}
        onReport={() => {
          if (actionsTarget) onReportMessage(actionsTarget);
          setActionsTarget(undefined);
        }}
        onCancel={() => setActionsTarget(undefined)}
      />

      <ReportReasonSheet
        visible={reportSheetOpen}
        targetName={connection?.otherProfile.displayName ?? 'this traveller'}
        onCancel={() => setReportSheetOpen(false)}
        onConfirm={onConfirmBlock}
      />

      <ProfilePreviewModal
        userId={previewOpen ? connection?.otherProfile.userId : undefined}
        matchInfo={connection ? connectionToMatchInfo(connection) : undefined}
        onClose={() => setPreviewOpen(false)}
      />
    </ScreenContainer>
  );
}

// How far right a swipe has to travel before releasing it commits to a reply, and the cap on
// how far the bubble is ever allowed to visually slide — small enough that even a "mine" bubble
// (already docked against the row's right edge) has room to move without overshooting the screen.
const SWIPE_REPLY_TRIGGER = 56;
const SWIPE_REPLY_MAX = 64;

function MessageBubble({
  message,
  isMine,
  resolveSenderLabel,
  onLongPress,
  onSwipeReply,
}: {
  message: Message;
  isMine: boolean;
  resolveSenderLabel: (senderId: string) => string;
  onLongPress: () => void;
  onSwipeReply: () => void;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const translateX = useRef(new Animated.Value(0)).current;
  const iconOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_REPLY_TRIGGER],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      // Only claims the gesture once it's clearly a rightward drag, not a tap or a vertical
      // scroll — anything else is left alone, so the surrounding FlatList keeps scrolling
      // normally and a plain tap/long-press still reaches the Pressable below untouched.
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        gesture.dx > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderMove: (_evt, gesture) => {
        translateX.setValue(Math.max(0, Math.min(gesture.dx, SWIPE_REPLY_MAX)));
      },
      onPanResponderRelease: (_evt, gesture) => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        if (gesture.dx > SWIPE_REPLY_TRIGGER) onSwipeReply();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      },
    }),
  ).current;

  return (
    <View style={styles.swipeWrap} {...panResponder.panHandlers}>
      <Animated.View style={[styles.swipeReplyIcon, { opacity: iconOpacity }]}>
        <Ionicons name="arrow-undo" size={18} color={colors.primary} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }}>
        <Pressable
          onLongPress={onLongPress}
          style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
        >
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
            {message.replyTo && (
              <View style={[styles.quoteBlock, isMine && styles.quoteBlockMine]}>
                <Text style={[styles.quoteLabel, isMine && styles.quoteLabelMine]} numberOfLines={1}>
                  {resolveSenderLabel(message.replyTo.senderId)}
                </Text>
                <Text style={[styles.quoteBody, isMine && styles.quoteBodyMine]} numberOfLines={1}>
                  {message.replyTo.body}
                </Text>
              </View>
            )}
            <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{message.body}</Text>
          </View>
          <Text style={styles.bubbleTime}>{time}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: 220 },
  headerTitleText: { ...typography.subtitle, color: colors.textPrimary, flexShrink: 1 },
  listContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexGrow: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  swipeWrap: { position: 'relative' },
  swipeReplyIcon: { position: 'absolute', left: 8, top: '50%', marginTop: -9 },
  bubbleRow: { marginBottom: spacing.sm, maxWidth: '80%' },
  bubbleRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleRowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleMine: {
    backgroundColor: colors.glassSurfaceBlue,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderBottomRightRadius: radius.sm,
  },
  bubbleTheirs: {
    backgroundColor: colors.glassSurface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderBottomLeftRadius: radius.sm,
  },
  bubbleText: { ...typography.body, color: colors.textPrimary },
  bubbleTextMine: { color: colors.white },
  bubbleTime: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  quoteBlock: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft: spacing.sm,
    marginBottom: spacing.xs,
  },
  // `primaryLight` rather than a plain white/grey tint — it's the same light blue already used
  // elsewhere (the welcome screen's window-sky gradient), so a reply quote on a navy bubble reads
  // as the app's own blue, not a washed-out, disconnected grey.
  quoteBlockMine: { borderLeftColor: colors.primaryLight },
  quoteLabel: { ...typography.label, color: colors.primary },
  quoteBody: { ...typography.caption, color: colors.textSecondary },
  quoteLabelMine: { color: colors.primaryLight },
  quoteBodyMine: { color: 'rgba(255, 255, 255, 0.75)' },
  blockedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  blockedText: { ...typography.body, color: colors.textSecondary, flex: 1 },
  blockedAction: { ...typography.body, color: colors.primary, fontWeight: '600' },
  replyPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  replyPreviewAccent: { width: 3, alignSelf: 'stretch', borderRadius: radius.sm, backgroundColor: colors.primary },
  replyPreviewText: { flex: 1 },
  replyPreviewLabel: { ...typography.label, color: colors.primary },
  replyPreviewBody: { ...typography.caption, color: colors.textSecondary },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Ionicons' "airplane" glyph points due east at rest — this rotates it to north-east, same
  // convention as the welcome screen's logo mark.
  sendIcon: { transform: [{ rotate: '-45deg' }] },
  sendButtonDisabled: { opacity: 0.4 },
});
