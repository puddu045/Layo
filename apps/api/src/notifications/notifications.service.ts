import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@layo/db';
import { socketEvents, type ListNotificationsQuery, type Notification, type NotificationPage } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { RedisService } from '../common/redis/redis.service';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
// Caps how many individual message previews a bumped notification keeps — unbounded growth here
// would bloat the FCM data payload (there's a hard ~4KB limit on it) for a conversation nobody's
// opened in a while. The oldest previews fall off first; `count` still tracks the true total.
const MAX_PREVIEWS = 5;
// Just UI-aggregation state for the OS push's stacked preview text, not data anyone needs kept
// around — a day is generous for "how many unread messages has this conversation accumulated".
const MESSAGE_PREVIEW_TTL_SECONDS = 24 * 60 * 60;

/** OS-push-only accumulation state for one unread conversation, keyed per
 * user+connection in Redis — see `createOrBumpMessageNotification`'s comment for why this no
 * longer lives in the `Notification` table at all. */
interface MessagePreviewState {
  fromUserDisplayName: string;
  count: number;
  previews: string[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
    private readonly redis: RedisService,
  ) {}

  /** Used by other modules (connections, businesses, deals) to raise a notification — never
   * called directly from a controller, since every notification is a side effect of some other
   * action, not something a client requests on its own. */
  async create(userId: string, type: string, payload: Record<string, unknown>): Promise<void> {
    const row = await this.prisma.client.notification.create({
      data: { userId, type, payload: payload as Prisma.InputJsonValue },
    });
    this.gateway.emitToUser(userId, socketEvents.NOTIFICATION_NEW, this.toNotification(row));
  }

  /** Fans a notification out to every current admin (any role) — used for admin-facing alerts
   * like a report escalating to CRITICAL, rather than one specific user. */
  async createForAdmins(type: string, payload: Record<string, unknown>): Promise<void> {
    const admins = await this.prisma.client.user.findMany({
      where: { isAdmin: true },
      select: { id: true },
    });
    await Promise.all(admins.map((admin) => this.create(admin.id, type, payload)));
  }

  /** Used by `MessagingService` for every new message. Messages no longer raise an in-app bell
   * notification at all — the Chats tab's own unread-message badge
   * (`ConnectionsService.getTotalUnreadCount`) is where that lives now, so the bell stays
   * reserved for `CONNECTION_REQUEST`/`CONNECTION_ACCEPTED`. This only drives the OS push: a
   * short-lived Redis entry, keyed per user+connection, accumulates the running count/preview
   * text so a second message before the first is read still shows a stacked preview (replacing
   * the previous OS notification via `tag`, not creating a second one) rather than silently
   * overwriting it with just the newest line. */
  async createOrBumpMessageNotification(
    userId: string,
    connectionId: string,
    fromUserId: string,
    fromUserDisplayName: string,
    preview: string,
  ): Promise<void> {
    const key = this.messagePreviewKey(userId, connectionId);
    const existing = await this.redis.getJson<MessagePreviewState>(key);

    const state: MessagePreviewState = {
      fromUserDisplayName,
      count: (existing?.count ?? 0) + 1,
      previews: [...(existing?.previews ?? []), preview].slice(-MAX_PREVIEWS),
    };
    await this.redis.setJson(key, state, MESSAGE_PREVIEW_TTL_SECONDS);

    const title = state.count > 1 ? `${fromUserDisplayName} (${state.count} new messages)` : fromUserDisplayName;
    await this.sendExpoPush(userId, title, state.previews.join('\n'), `message-${connectionId}`, {
      connectionId,
      type: 'MESSAGE_NEW',
    });
  }

  async list(userId: string, query: ListNotificationsQuery): Promise<NotificationPage> {
    const [rows, unreadCount] = await Promise.all([
      this.prisma.client.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: query.limit + 1,
        ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      }),
      this.prisma.client.notification.count({ where: { userId, readAt: null } }),
    ]);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page.map((row) => this.toNotification(row)),
      unreadCount,
      nextCursor: hasMore ? page[page.length - 1]!.id : undefined,
    };
  }

  /** Used by `MessagingService` when a conversation is marked read — clears that conversation's
   * OS-push accumulation state (see `createOrBumpMessageNotification`) so the next message
   * starts a fresh preview instead of appending to an already-read one. */
  async markReadForConnection(userId: string, connectionId: string): Promise<void> {
    await this.redis.del(this.messagePreviewKey(userId, connectionId));
  }

  private messagePreviewKey(userId: string, connectionId: string): string {
    return `message-push-preview:${userId}:${connectionId}`;
  }

  async markRead(userId: string, notificationId: string): Promise<{ success: true }> {
    await this.prisma.client.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async markAllRead(userId: string): Promise<{ success: true }> {
    await this.prisma.client.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  /** Best-effort OS push for scenarios the recipient's device can't show any other way — the
   * socket emit above only updates the app while it's actually open and connected. Scoped to
   * message notifications only for now (not every notification type), since that's the one
   * this was asked for. A delivery failure (bad/expired token, Expo's service down) never fails
   * the request that triggered it — the in-app notification already succeeded regardless.
   *
   * Sends a real top-level `title`/`body`, not a "data-only" push — this used to be data-only
   * specifically to make killed-app delivery more reliable, on the theory that Google Play
   * Services' own privileged delivery path was more dependable than waking the app's JS runtime.
   * That theory had a real gap: FCM only auto-displays a notification *without running any of the
   * app's own code* when the payload has a `notification` field. A **data-only** message, whether
   * the app is merely backgrounded or fully killed, still has to wake the app's own
   * `FirebaseMessagingService` to process it — exactly the kind of wake-up aggressive OEM battery
   * managers (and, confirmed in practice, even plain background state on some devices) block.
   * Confirmed as a real regression: push stopped arriving in the background too after switching
   * to data-only, which had worked before that change.
   *
   * `tag` is Expo's own top-level field (Android only) — maps directly to FCM's native
   * `notification.tag`, which is what the OS itself reads to replace an already-shown
   * notification in place, independent of any app code ever running. This is NOT the same as
   * putting a `tag` inside `data`: that only worked for the previous data-only approach, where
   * `expo-notifications`' own JS/native code was the thing reading `data.tag` — which never runs
   * at all for a title+body push once the OS auto-displays it directly in the background/killed
   * state. Confirmed in production: with `tag` left inside `data`, every message stacked a brand
   * new notification instead of replacing the previous one, since nothing ever read that field.
   * `data` here is now just for the deep-link (`connectionId`/`type`), delivered as extras on the
   * notification's tap intent, not anything the OS needs for display or replacement.
   * `priority: 'high'` asks FCM to delay delivery as little as possible under Doze. */
  private async sendExpoPush(
    userId: string,
    title: string,
    body: string,
    tag: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      const tokens = await this.prisma.client.pushToken.findMany({ where: { userId }, select: { token: true } });
      if (tokens.length === 0) {
        // Logged unconditionally, not just on failure — this and the two log lines below are the
        // only way to tell "never even tried" apart from "tried and it actually worked", since a
        // fully successful send previously produced no log output at all.
        this.logger.log(`No push token on file for user ${userId} — nothing to send.`);
        return;
      }

      const response = await fetch(EXPO_PUSH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(
          tokens.map(({ token }) => ({ to: token, title, body, channelId: 'default', tag, data, priority: 'high' })),
        ),
      });
      if (!response.ok) {
        this.logger.warn(`Expo push API returned ${response.status} for user ${userId}`);
        return;
      }

      // A non-2xx HTTP status only covers the request itself being malformed - Expo still
      // returns 200 with one "ticket" per token, and each ticket carries its own status. A
      // silent `DeviceNotRegistered` ticket (stale token - old install, cleared data, etc.) is
      // exactly the kind of failure that looks identical to "nothing happened" from every other
      // signal available here, so this is read and logged instead of only checking `response.ok`.
      // Named `responseBody`, not `body` — this function also takes a `body` *parameter* (the
      // push's own text), and a same-named `const` anywhere in this scope makes the whole
      // function body treat `body` as uninitialized until this line runs, breaking the request
      // actually sent above: confirmed in production as "Cannot access 'body' before
      // initialization", silently failing every single push since the previous deploy.
      const responseBody = (await response.json()) as { data?: { status: string; id?: string; message?: string; details?: { error?: string } }[] };
      const tickets = responseBody.data ?? [];
      const staleTokens: string[] = [];
      tickets.forEach((ticket, i) => {
        if (ticket.status !== 'error') {
          this.logger.log(`Expo accepted push for user ${userId} (token ${i + 1}/${tokens.length}), ticket id ${ticket.id}.`);
          return;
        }
        this.logger.warn(`Expo push ticket error for user ${userId}: ${ticket.details?.error ?? ticket.message}`);
        if (ticket.details?.error === 'DeviceNotRegistered') {
          const token = tokens[i]?.token;
          if (token) staleTokens.push(token);
        }
      });
      if (staleTokens.length > 0) {
        await this.prisma.client.pushToken.deleteMany({ where: { token: { in: staleTokens } } });
      }
    } catch (err) {
      this.logger.warn(`Expo push delivery failed for user ${userId}: ${err instanceof Error ? err.message : err}`);
    }
  }

  private toNotification(row: {
    id: string;
    type: string;
    payload: unknown;
    readAt: Date | null;
    createdAt: Date;
  }): Notification {
    return {
      id: row.id,
      type: row.type,
      payload: (row.payload as Record<string, unknown>) ?? {},
      readAt: row.readAt?.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
