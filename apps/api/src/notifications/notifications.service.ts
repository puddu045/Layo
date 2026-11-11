import { Injectable } from '@nestjs/common';
import type { Prisma } from '@layo/db';
import { socketEvents, type ListNotificationsQuery, type Notification, type NotificationPage } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class NotificationsService {
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
