import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@layo/db';
import { socketEvents, type ListNotificationsQuery, type Notification, type NotificationPage } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
// Caps how many individual message previews a bumped notification keeps — unbounded growth here
// would bloat the FCM data payload (there's a hard ~4KB limit on it) for a conversation nobody's
// opened in a while. The oldest previews fall off first; `count` still tracks the true total.
const MAX_PREVIEWS = 5;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
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

  /** Used by `MessagingService` for every new message — rather than `create()`, which would
   * leave one separate unread row per message (10 messages in a row from the same person showed
   * up as 10 separate notifications). If an unread `MESSAGE_NEW` for this exact connection
   * already exists, this bumps it in place — appends to the kept previews (capped at
   * `MAX_PREVIEWS`, oldest dropped first), increments `count`, resets `createdAt` so it
   * resurfaces at the top — instead of inserting another row. `count` is the true total even
   * once `previews` has capped out, so "12 new messages" stays accurate even though only the
   * last 5 bodies are kept.
   *
   * Pushes on *every* message, not just the first unread one — see `sendExpoPush`'s own comment
   * for why that's now safe to do without flooding the Android tray. */
  async createOrBumpMessageNotification(
    userId: string,
    connectionId: string,
    fromUserId: string,
    fromUserDisplayName: string,
    preview: string,
  ): Promise<void> {
    const existing = await this.prisma.client.notification.findFirst({
      where: { userId, type: 'MESSAGE_NEW', readAt: null, payload: { path: ['connectionId'], equals: connectionId } },
    });

    const existingPayload = existing?.payload as Record<string, unknown> | undefined;
    const count = (Number(existingPayload?.count) || 1) + (existing ? 1 : 0);
    const previews = [
      ...(Array.isArray(existingPayload?.previews) ? (existingPayload.previews as string[]) : []),
      preview,
    ].slice(-MAX_PREVIEWS);

    const payload = { connectionId, fromUserId, fromUserDisplayName, preview, previews, count };
    const row = existing
      ? await this.prisma.client.notification.update({ where: { id: existing.id }, data: { createdAt: new Date(), payload } })
      : await this.prisma.client.notification.create({ data: { userId, type: 'MESSAGE_NEW', payload } });

    this.gateway.emitToUser(userId, socketEvents.NOTIFICATION_NEW, this.toNotification(row));

    const title = count > 1 ? `${fromUserDisplayName} (${count} new messages)` : fromUserDisplayName;
    await this.sendExpoPush(userId, {
      // Expo's Android implementation reads these three keys directly out of a data-only
      // message's `data` map to build a real system notification (see `sendExpoPush`'s comment
      // for the exact source) — title/message/tag, not the push API's own top-level fields.
      title,
      message: previews.join('\n'),
      tag: `message-${connectionId}`,
      channelId: 'default',
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

  /** Used by `MessagingService` when a conversation is marked read, so a `MESSAGE_NEW`
   * notification doesn't keep sitting unread in the bell once the recipient has actually opened
   * that chat — without this, every message would leave a permanent unread notification behind
   * even though the person already saw it. Matches on the connectionId recorded in the
   * notification's own payload at creation time. */
  async markReadForConnection(userId: string, connectionId: string): Promise<void> {
    await this.prisma.client.notification.updateMany({
      where: {
        userId,
        type: 'MESSAGE_NEW',
        readAt: null,
        payload: { path: ['connectionId'], equals: connectionId },
      },
      data: { readAt: new Date() },
    });
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
   * Deliberately sends no top-level `title`/`body` on the push itself — this is a "data-only"
   * FCM message, which matters because of how `expo-notifications`' own Android native code
   * handles one (traced directly in `expo-notifications/android/.../RemoteNotificationContent.kt`
   * + `NotificationData.kt`, since this isn't documented anywhere obvious): it still builds and
   * displays a real system notification, reading `data.title` / `data.message` for the content
   * and `data.tag` as the notification's native identifier — posting a second notification with
   * the *same* tag replaces the first instead of stacking a new one, which is exactly the
   * replace-in-place behaviour needed here, built into Android's own notification system rather
   * than anything this app has to maintain. This path also runs through Google Play Services'
   * own privileged delivery, independent of this app's JS ever executing — unlike an approach
   * built on a client-side background task (tried first; didn't fire reliably once the app was
   * actually killed, not just backgrounded), which needs the OS to wake the app's JS runtime
   * first. `priority: 'high'` asks FCM to delay delivery as little as possible under Doze. */
  private async sendExpoPush(userId: string, data: Record<string, unknown>): Promise<void> {
    try {
      const tokens = await this.prisma.client.pushToken.findMany({ where: { userId }, select: { token: true } });
      if (tokens.length === 0) return;

      const response = await fetch(EXPO_PUSH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(tokens.map(({ token }) => ({ to: token, data, priority: 'high' }))),
      });
      if (!response.ok) {
        this.logger.warn(`Expo push API returned ${response.status} for user ${userId}`);
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
