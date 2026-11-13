import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@layo/db';
import { socketEvents, type ListNotificationsQuery, type Notification, type NotificationPage } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

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
   * already exists, this bumps it in place (new preview, incremented count, `createdAt` reset so
   * it resurfaces at the top) instead of inserting another row — one notification per
   * conversation with unread messages, not one per message. */
  async createOrBumpMessageNotification(userId: string, connectionId: string, fromUserId: string, preview: string): Promise<void> {
    const existing = await this.prisma.client.notification.findFirst({
      where: { userId, type: 'MESSAGE_NEW', readAt: null, payload: { path: ['connectionId'], equals: connectionId } },
    });

    const count = (Number((existing?.payload as Record<string, unknown>)?.count) || 1) + (existing ? 1 : 0);
    const row = existing
      ? await this.prisma.client.notification.update({
          where: { id: existing.id },
          data: { createdAt: new Date(), payload: { connectionId, fromUserId, preview, count } },
        })
      : await this.prisma.client.notification.create({
          data: { userId, type: 'MESSAGE_NEW', payload: { connectionId, fromUserId, preview, count } },
        });

    this.gateway.emitToUser(userId, socketEvents.NOTIFICATION_NEW, this.toNotification(row));
    await this.sendExpoPush(
      userId,
      count > 1 ? `${count} new messages` : 'New message',
      preview,
      { connectionId, type: 'MESSAGE_NEW' },
    );
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
   * this was asked for and every other type would need its own title/body copy to push
   * sensibly. A delivery failure (bad/expired token, Expo's service down) never fails the
   * request that triggered it — the in-app notification already succeeded regardless. */
  private async sendExpoPush(userId: string, title: string, body: string, data: Record<string, unknown>): Promise<void> {
    try {
      const tokens = await this.prisma.client.pushToken.findMany({ where: { userId }, select: { token: true } });
      if (tokens.length === 0) return;

      const response = await fetch(EXPO_PUSH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(
          tokens.map(({ token }) => ({ to: token, title, body, data, sound: 'default', channelId: 'default' })),
        ),
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
