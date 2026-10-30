import { ForbiddenException, Injectable } from '@nestjs/common';
import type { ListMessagesQuery, Message, PaginatedResponse, SendMessageRequest } from '@layo/contracts';
import { socketEvents } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConnectionsService } from '../connections/connections.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { BlocksService } from '../safety/blocks.service';

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionsService: ConnectionsService,
    private readonly gateway: RealtimeGateway,
    private readonly blocksService: BlocksService,
  ) {}

  async list(userId: string, connectionId: string, query: ListMessagesQuery): Promise<PaginatedResponse<Message>> {
    await this.connectionsService.requireAcceptedParticipant(userId, connectionId);

    const [rows, total] = await Promise.all([
      this.prisma.client.message.findMany({
        where: { connectionId },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
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

    const [row] = await this.prisma.client.$transaction([
      this.prisma.client.message.create({
        data: { connectionId, senderId: userId, body: dto.body },
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

    return message;
  }

  async markRead(userId: string, connectionId: string): Promise<{ markedCount: number }> {
    const connection = await this.connectionsService.requireAcceptedParticipant(userId, connectionId);

    const result = await this.prisma.client.message.updateMany({
      where: { connectionId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });

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
}

function toMessageDto(row: {
  id: string;
  connectionId: string;
  senderId: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
}): Message {
  return {
    id: row.id,
    connectionId: row.connectionId,
    senderId: row.senderId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString(),
  };
}
