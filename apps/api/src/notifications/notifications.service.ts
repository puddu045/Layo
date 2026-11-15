import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@layo/db';
import { socketEvents, type ListNotificationsQuery, type Notification, type NotificationPage } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
// Caps how many individual message previews a bumped notification keeps — unbounded growth here
// would bloat the FCM data payload (there's a hard ~4KB limit on it) for a conversation nobody's
// opened in a while. The oldest previews fall off first; `countByConnection` still tracks the
// true total per conversation.
const MAX_PREVIEWS = 5;

/** The single, per-user `MESSAGE_NEW` notification's payload shape — see
 * `createOrBumpMessageNotification`'s own comment for why this is keyed by connection
 * internally despite there only ever being one row. */
interface MessageNewPayload {
  countByConnection: Record<string, number>;
  previewsByConnection: Record<string, { fromUserDisplayName: string; previews: string[] }>;
}

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

  /** Used by `MessagingService` for every new message. Unlike the OS push below (still one
   * per-conversation system-tray entry, so it can keep deep-linking to the right chat on tap),
   * the in-app bell deliberately collapses every unread message, from any conversation or
   * sender, into ONE notification row per user — the Chats list itself is where per-conversation
   * detail belongs (it already shows its own per-chat unread state from `Message.readAt`), so the
   * bell only needs to say "you have unread messages" and send you there.
   *
   * The row's payload still tracks state *per connection* internally (`countByConnection`,
   * `previewsByConnection`) purely so `markReadForConnection` can remove just that conversation's
   * share when it's read, without guessing at the others — the row only actually clears once
   * every connection's contribution is gone. */
  async createOrBumpMessageNotification(
    userId: string,
    connectionId: string,
    fromUserId: string,
    fromUserDisplayName: string,
    preview: string,
  ): Promise<void> {
    const existing = await this.prisma.client.notification.findFirst({
      where: { userId, type: 'MESSAGE_NEW', readAt: null },
    });

    const existingPayload = existing?.payload as MessageNewPayload | undefined;
    const countByConnection = { ...existingPayload?.countByConnection };
    const previewsByConnection = { ...existingPayload?.previewsByConnection };

    countByConnection[connectionId] = (countByConnection[connectionId] ?? 0) + 1;
    previewsByConnection[connectionId] = {
      fromUserDisplayName,
      previews: [...(previewsByConnection[connectionId]?.previews ?? []), preview].slice(-MAX_PREVIEWS),
    };

    const payload: MessageNewPayload = { countByConnection, previewsByConnection };
    const row = existing
      ? await this.prisma.client.notification.update({
          where: { id: existing.id },
          data: { createdAt: new Date(), payload: payload as unknown as Prisma.InputJsonValue },
        })
      : await this.prisma.client.notification.create({
          data: { userId, type: 'MESSAGE_NEW', payload: payload as unknown as Prisma.InputJsonValue },
        });

    this.gateway.emitToUser(userId, socketEvents.NOTIFICATION_NEW, this.toNotification(row));

    // OS push: still scoped to this one conversation, so the system tray keeps stacking/replacing
    // per conversation and tapping it deep-links to the right chat — independent of the bell's
    // aggregate row above.
    const count = countByConnection[connectionId]!;
    const title = count > 1 ? `${fromUserDisplayName} (${count} new messages)` : fromUserDisplayName;
    await this.sendExpoPush(
      userId,
      title,
      previewsByConnection[connectionId]!.previews.join('\n'),
      { tag: `message-${connectionId}`, connectionId, type: 'MESSAGE_NEW' },
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

  /** Used by `MessagingService` when a conversation is marked read. Since the bell's `MESSAGE_NEW`
   * row is now a single per-user aggregate (see `createOrBumpMessageNotification`), reading one
   * conversation doesn't necessarily mean the whole row is read — this removes just this
   * connection's share of it, and only actually marks the row read once every connection's share
   * is gone (i.e. nothing left unread anywhere). Without this, every message would leave a
   * permanently unread aggregate behind even after the person read every conversation. */
  async markReadForConnection(userId: string, connectionId: string): Promise<void> {
    const existing = await this.prisma.client.notification.findFirst({
      where: { userId, type: 'MESSAGE_NEW', readAt: null },
    });
    if (!existing) return;

    const payload = existing.payload as unknown as MessageNewPayload;
    if (!(connectionId in payload.countByConnection)) return;

    const countByConnection = { ...payload.countByConnection };
    const previewsByConnection = { ...payload.previewsByConnection };
    delete countByConnection[connectionId];
    delete previewsByConnection[connectionId];

    if (Object.keys(countByConnection).length === 0) {
      await this.prisma.client.notification.update({ where: { id: existing.id }, data: { readAt: new Date() } });
    } else {
      await this.prisma.client.notification.update({
        where: { id: existing.id },
        data: { payload: { countByConnection, previewsByConnection } as unknown as Prisma.InputJsonValue },
      });
    }
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
   * A title+body+data push still carries `data` (tag/connectionId/type below) for the deep-link
   * and replace-in-place behaviour — FCM attaches it as extras on the notification's own tap
   * intent, delivered to the app on open, without requiring any code to run for display itself.
   * `priority: 'high'` asks FCM to delay delivery as little as possible under Doze. */
  private async sendExpoPush(
    userId: string,
    title: string,
    body: string,
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
          tokens.map(({ token }) => ({ to: token, title, body, channelId: 'default', data, priority: 'high' })),
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
