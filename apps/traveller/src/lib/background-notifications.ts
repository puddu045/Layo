import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

export const BACKGROUND_NOTIFICATION_TASK = 'LAYO_BACKGROUND_NOTIFICATION_TASK';

/**
 * Defined at module scope and imported for its side effect only (see `app/_layout.tsx`) —
 * `expo-task-manager` re-evaluates the whole JS bundle to find this definition when the OS wakes
 * the app in the background/killed to deliver a push, so it has to exist somewhere that import
 * graph definitely reaches, not inside a component.
 *
 * `NotificationsService.sendExpoPush` (API) sends every message push as data-only, with no
 * title/body of its own — this task is what actually turns that data into something visible,
 * and it's the only thing in this whole pipeline that can make Android *replace* a still-unread
 * conversation's notification instead of stacking a new one: `scheduleNotificationAsync`'s
 * `identifier` becomes the underlying Android notification ID, so reusing the same one (derived
 * from `connectionId`) for a later message updates the existing tray entry in place. Expo's
 * remote push API has no equivalent of Android's native notification-tag/replace mechanism, so
 * there's no way to get this behaviour without a client-side step like this one.
 */
TaskManager.defineTask<Notifications.NotificationTaskPayload>(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  // A notification *response* (the user tapped one) has `actionIdentifier`; new data arriving
  // doesn't. Matches the discrimination Expo's own docs use for this exact payload union.
  if ('actionIdentifier' in data) return;

  const dataString = data.data?.dataString;
  if (!dataString) return;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(dataString);
  } catch {
    return;
  }

  if (payload.type !== 'MESSAGE_NEW' || typeof payload.connectionId !== 'string') return;

  const count = Number(payload.count) || 1;
  const senderName = typeof payload.senderName === 'string' ? payload.senderName : 'Someone';
  const previews = Array.isArray(payload.previews)
    ? payload.previews.filter((p): p is string => typeof p === 'string')
    : [];
  // Joined with newlines, not space-separated or just the latest one — Android's notification
  // view applies BigTextStyle to a multi-line body by default, so pulling the notification down
  // shows every kept message instead of only the one that happened to trigger this particular
  // replace.
  const body = previews.length > 0 ? previews.join('\n') : 'Sent you a message';

  await Notifications.scheduleNotificationAsync({
    // Same identifier every time for this conversation — the replace, not the content, is the
    // whole point of this task existing.
    identifier: `message-${payload.connectionId}`,
    content: {
      title: count > 1 ? `${senderName} (${count} new messages)` : senderName,
      body,
      data: { connectionId: payload.connectionId },
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
    },
    trigger: null,
  });
});
