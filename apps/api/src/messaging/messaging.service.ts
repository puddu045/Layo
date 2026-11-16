import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { ListMessagesQuery, Message, PaginatedResponse, SendMessageRequest } from '@layo/contracts';
import { socketEvents } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConnectionsService } from '../connections/connections.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { BlocksService } from '../safety/blocks.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionsService: ConnectionsService,
    private readonly gateway: RealtimeGateway,
    private readonly blocksService: BlocksService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async list(userId: string, connectionId: string, query: ListMessagesQuery): Promise<PaginatedResponse<Message>> {
    const connection = await this.connectionsService.requireAcceptedParticipant(userId, connectionId);

    // Only the direction that matters here: if the *other* participant blocked this viewer, the
    // viewer loses the conversation entirely. The reverse (the viewer did the blocking) still
    // reads fine — a blocker keeps their own message history, they just can't send any more.
    const otherParticipantId = connection.requesterId === userId ? connection.addresseeId : connection.requesterId;
    if (await this.blocksService.isBlockedBy(otherParticipantId, userId)) {
      throw new ForbiddenException('This conversation is no longer available');
    }

    const [rows, total] = await Promise.all([
      this.prisma.client.message.findMany({
        where: { connectionId },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { replyTo: { select: { id: true, senderId: true, body: true } } },
      }),
      this.prisma.client.message.count({ where: { connectionId } }),
    ]);

    return {
      items: rows.map(toMessageDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize) || 0,
    };
  }

  async send(userId: string, connectionId: string, dto: SendMessageRequest): Promise<Message> {
    const connection = await this.connectionsService.requireAcceptedParticipant(userId, connectionId);

    const otherParticipantId = connection.requesterId === userId ? connection.addresseeId : connection.requesterId;
    if (await this.blocksService.isBlockedEitherWay(userId, otherParticipantId)) {
      // A block can happen after a connection was already accepted — re-check on every send
      // rather than relying only on the one-time check when the connection was created.
      throw new ForbiddenException('You cannot message this user');
    }

    // Dropped rather than rejected if it doesn't check out (already gone, or — since a client
    // only ever offers to reply to a message it already has rendered — somehow from a different
    // connection): a reply quote is a nice-to-have, not worth failing the whole send over.
    const replyToMessageId = dto.replyToMessageId
      ? await this.prisma.client.message
          .findUnique({ where: { id: dto.replyToMessageId }, select: { connectionId: true } })
          .then((m) => (m?.connectionId === connectionId ? dto.replyToMessageId : undefined))
      : undefined;

    const [row] = await this.prisma.client.$transaction([
      this.prisma.client.message.create({
        data: { connectionId, senderId: userId, body: dto.body, replyToMessageId },
        include: { replyTo: { select: { id: true, senderId: true, body: true } } },
      }),
      this.prisma.client.connection.update({
        where: { id: connectionId },
        data: { updatedAt: new Date() },
      }),
    ]);

    const message = toMessageDto(row);
    const otherUserId = connection.requesterId === userId ? connection.addresseeId : connection.requesterId;
    this.gateway.emitToUser(otherUserId, socketEvents.MESSAGE_NEW, { connectionId, message });
    this.gateway.emitToUser(userId, socketEvents.MESSAGE_NEW, { connectionId, message });

    // Skip the notification entirely if the recipient already has this exact conversation open
    // live (checked via their socket's room membership) — they're looking at the message as it
    // arrives, so a notification for it would be redundant. Any *other* conversation still
    // notifies normally, since this check is scoped to this one connectionId.
    const recipientIsActive = await this.gateway.isUserActiveInChat(otherUserId, connectionId);
    // Logged unconditionally (not just on error) — a push that's silently skipped because the
    // recipient's socket still looks "active" in this chat (e.g. the app was only backgrounded,
    // not fully killed or navigated away, so nothing ever told the server to leave the room) was
    // indistinguishable from a push that was sent and simply never displayed, with nothing in the
    // logs either way.
    this.logger.log(
      `Message in connection ${connectionId}: recipient ${otherUserId} active-in-chat=${recipientIsActive}` +
        (recipientIsActive ? ' — notification skipped' : ' — sending notification/push'),
    );
    if (!recipientIsActive) {
      const senderProfile = await this.prisma.client.profile.findUnique({
        where: { userId },
        select: { displayName: true },
      });
      await this.notificationsService.createOrBumpMessageNotification(
        otherUserId,
        connectionId,
        userId,
        senderProfile?.displayName ?? 'Someone',
        dto.body.slice(0, 120),
      );
    }

    return message;
  }

  async markRead(userId: string, connectionId: string): Promise<{ markedCount: number }> {
    const connection = await this.connectionsService.requireAcceptedParticipant(userId, connectionId);

    // A system message (`isSystem`, no `senderId`) counts as unread for both participants, same
    // as a real message from the other person — see `ConnectionsService.unreadBySomeoneElse`'s
    // comment for why this isn't just `senderId: { not: userId }`.
    const result = await this.prisma.client.message.updateMany({
      where: { connectionId, OR: [{ senderId: { not: userId } }, { isSystem: true }], readAt: null },
      data: { readAt: new Date() },
    });

    await this.notificationsService.markReadForConnection(userId, connectionId);

    if (result.count > 0) {
      const otherUserId = connection.requesterId === userId ? connection.addresseeId : connection.requesterId;
      this.gateway.emitToUser(otherUserId, socketEvents.MESSAGE_READ, {
        connectionId,
        readByUserId: userId,
        readAt: new Date().toISOString(),
      });
    }

    return { markedCount: result.count };
  }

  /** Posts an automated message into a connection's chat — "you're both travelling together
   * again" and the like — rather than something either participant typed (see `Message.isSystem`
   * and `JourneysService.notifyConnectedTravelOverlaps`, its one caller). Bumps `updatedAt` and
   * emits `MESSAGE_NEW` the same way a real send does, so the conversation moves to the top of
   * the Chats list for both of them, and raises a bell notification for both too — unlike a real
   * message, which only pushes/bell-notifies the recipient, there's no single "sender" here for
   * either side to already know about this from having typed it themselves. */
  async createSystemMessage(connectionId: string, userAId: string, userBId: string, body: string): Promise<Message> {
    const [row] = await this.prisma.client.$transaction([
      this.prisma.client.message.create({
        data: { connectionId, body, isSystem: true },
        include: { replyTo: { select: { id: true, senderId: true, body: true } } },
      }),
      this.prisma.client.connection.update({
        where: { id: connectionId },
        data: { updatedAt: new Date() },
      }),
    ]);

    const message = toMessageDto(row);
    this.gateway.emitToUser(userAId, socketEvents.MESSAGE_NEW, { connectionId, message });
    this.gateway.emitToUser(userBId, socketEvents.MESSAGE_NEW, { connectionId, message });

    await Promise.all([
      this.notificationsService.create(userAId, 'TRAVELLING_TOGETHER', { connectionId, body }),
      this.notificationsService.create(userBId, 'TRAVELLING_TOGETHER', { connectionId, body }),
    ]);

    return message;
  }
}

function toMessageDto(row: {
  id: string;
  connectionId: string;
  senderId: string | null;
  body: string;
  isSystem: boolean;
  replyTo: { id: string; senderId: string | null; body: string } | null;
  createdAt: Date;
  readAt: Date | null;
}): Message {
  return {
    id: row.id,
    connectionId: row.connectionId,
    senderId: row.senderId ?? undefined,
    body: row.body,
    isSystem: row.isSystem,
    replyTo: row.replyTo ? { ...row.replyTo, senderId: row.replyTo.senderId ?? undefined } : undefined,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString(),
  };
}
