import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Connection, ConnectionMatchContext, ConnectionStatus, ListConnectionsQuery } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { toPublicProfile } from '../common/mappers/profile.mapper';
import { BlocksService } from '../safety/blocks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { decideConnectRequestAction, type ExistingConnectionInfo } from './connection-state.util';

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocksService: BlocksService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async sendRequest(userId: string, addresseeUserId: string, matchContext?: ConnectionMatchContext): Promise<Connection> {
    if (userId === addresseeUserId) {
      throw new BadRequestException('You cannot send a connection request to yourself');
    }

    const addressee = await this.prisma.client.user.findUnique({ where: { id: addresseeUserId } });
    if (!addressee) throw new NotFoundException('User not found');

    if (await this.blocksService.isBlockedEitherWay(userId, addresseeUserId)) {
      throw new ForbiddenException('You cannot connect with this user');
    }

    const existingRow = await this.prisma.client.connection.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: addresseeUserId },
          { requesterId: addresseeUserId, addresseeId: userId },
        ],
      },
    });

    const existing: ExistingConnectionInfo | null = existingRow
      ? {
          id: existingRow.id,
          status: existingRow.status,
          direction: existingRow.requesterId === userId ? 'ME_TO_OTHER' : 'OTHER_TO_ME',
        }
      : null;

    const action = decideConnectRequestAction(existing);

    switch (action.type) {
      case 'CREATE': {
        const created = await this.prisma.client.connection.create({
          data: { requesterId: userId, addresseeId: addresseeUserId, status: 'PENDING', ...toMatchContextData(matchContext) },
        });
        await this.notifyConnectionRequest(addresseeUserId, created.id, userId);
        return this.toConnectionDto(created, userId);
      }
      case 'AUTO_ACCEPT': {
        // Never overwrites matchCategory/etc. here — the existing row already carries the
        // original requester's own match context from when *they* created it.
        const updated = await this.prisma.client.connection.update({
          where: { id: action.existingId },
          data: { status: 'ACCEPTED' },
        });
        await this.notifyConnectionAccepted(updated.requesterId, updated.id, userId);
        return this.toConnectionDto(updated, userId);
      }
      case 'REOPEN': {
        const updated = await this.prisma.client.connection.update({
          where: { id: action.existingId },
          data: {
            requesterId: userId,
            addresseeId: addresseeUserId,
            status: 'PENDING',
            ...toMatchContextData(matchContext),
          },
        });
        await this.notifyConnectionRequest(addresseeUserId, updated.id, userId);
        return this.toConnectionDto(updated, userId);
      }
      case 'REJECT': {
        throw new ConflictException(
          action.reason === 'ALREADY_CONNECTED'
            ? 'You are already connected with this traveller'
            : 'A connection request is already pending',
        );
      }
    }
  }

  async accept(userId: string, connectionId: string): Promise<Connection> {
    const connection = await this.requireConnection(connectionId);
    if (connection.addresseeId !== userId) {
      throw new ForbiddenException('Only the recipient can accept this request');
    }
    if (connection.status !== 'PENDING') {
      throw new ConflictException('This request is no longer pending');
    }
    const updated = await this.prisma.client.connection.update({
      where: { id: connectionId },
      data: { status: 'ACCEPTED' },
    });
    await this.notifyConnectionAccepted(updated.requesterId, updated.id, userId);
    return this.toConnectionDto(updated, userId);
  }

  async decline(userId: string, connectionId: string): Promise<Connection> {
    const connection = await this.requireConnection(connectionId);
    if (connection.addresseeId !== userId) {
      throw new ForbiddenException('Only the recipient can decline this request');
    }
    if (connection.status !== 'PENDING') {
      throw new ConflictException('This request is no longer pending');
    }
    const updated = await this.prisma.client.connection.update({
      where: { id: connectionId },
      data: { status: 'DECLINED' },
    });
    return this.toConnectionDto(updated, userId);
  }

  async cancel(userId: string, connectionId: string): Promise<Connection> {
    const connection = await this.requireConnection(connectionId);
    if (connection.requesterId !== userId) {
      throw new ForbiddenException('Only the sender can cancel this request');
    }
    if (connection.status !== 'PENDING') {
      throw new ConflictException('This request is no longer pending');
    }
    const updated = await this.prisma.client.connection.update({
      where: { id: connectionId },
      data: { status: 'CANCELLED' },
    });
    return this.toConnectionDto(updated, userId);
  }

  async list(userId: string, query: ListConnectionsQuery): Promise<Connection[]> {
    const rows = await this.prisma.client.connection.findMany({
      where: {
        OR: [{ requesterId: userId }, { addresseeId: userId }],
        ...(query.status && { status: query.status }),
      },
      orderBy: { updatedAt: 'desc' },
    });

    return Promise.all(rows.map((row) => this.toConnectionDto(row, userId)));
  }

  /** Used by MessagingService to verify a user may read/send on a connection. */
  async requireAcceptedParticipant(userId: string, connectionId: string) {
    const connection = await this.requireConnection(connectionId);
    if (connection.requesterId !== userId && connection.addresseeId !== userId) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }
    if (connection.status !== 'ACCEPTED') {
      throw new ConflictException('This connection has not been accepted yet');
    }
    return connection;
  }

  private async notifyConnectionRequest(addresseeUserId: string, connectionId: string, fromUserId: string) {
    await this.notificationsService.create(addresseeUserId, 'CONNECTION_REQUEST', { connectionId, fromUserId });
  }

  private async notifyConnectionAccepted(requesterUserId: string, connectionId: string, byUserId: string) {
    await this.notificationsService.create(requesterUserId, 'CONNECTION_ACCEPTED', { connectionId, byUserId });
  }

  private async requireConnection(connectionId: string) {
    const connection = await this.prisma.client.connection.findUnique({ where: { id: connectionId } });
    if (!connection) throw new NotFoundException('Connection not found');
    return connection;
  }

  private async toConnectionDto(
    row: {
      id: string;
      status: string;
      requesterId: string;
      addresseeId: string;
      createdAt: Date;
      updatedAt: Date;
      matchCategory?: string | null;
      matchAirportIata?: string | null;
      matchFlightNumber?: string | null;
      matchOverlapStartUtc?: Date | null;
      matchOverlapEndUtc?: Date | null;
    },
    viewerId: string,
  ): Promise<Connection> {
    const otherUserId = row.requesterId === viewerId ? row.addresseeId : row.requesterId;

    const [otherProfile, unreadCount, lastMessage, blockedByMe] = await Promise.all([
      this.prisma.client.profile.findUnique({ where: { userId: otherUserId } }),
      this.prisma.client.message.count({
        where: { connectionId: row.id, senderId: { not: viewerId }, readAt: null },
      }),
      this.prisma.client.message.findFirst({
        where: { connectionId: row.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.blocksService.isBlockedBy(viewerId, otherUserId),
    ]);

    if (!otherProfile) {
      throw new NotFoundException('The other traveller in this connection no longer has a profile');
    }

    return {
      id: row.id,
      status: row.status as ConnectionStatus,
      direction: row.requesterId === viewerId ? 'SENT' : 'RECEIVED',
      requesterId: row.requesterId,
      addresseeId: row.addresseeId,
      otherProfile: toPublicProfile(otherProfile),
      unreadCount,
      blockedByMe,
      lastMessage: lastMessage
        ? { body: lastMessage.body, senderId: lastMessage.senderId, createdAt: lastMessage.createdAt.toISOString() }
        : undefined,
      matchCategory: (row.matchCategory as Connection['matchCategory']) ?? undefined,
      matchAirportIata: row.matchAirportIata ?? undefined,
      matchFlightNumber: row.matchFlightNumber ?? undefined,
      matchOverlapStartUtc: row.matchOverlapStartUtc?.toISOString(),
      matchOverlapEndUtc: row.matchOverlapEndUtc?.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

/** `undefined` matchContext (no Discover card behind this request) must produce `{}`, not a set
 * of explicit nulls — Prisma treats a field simply absent from `data` as "don't touch it",
 * which matters for `AUTO_ACCEPT`-adjacent paths reusing this on an update. */
function toMatchContextData(matchContext: ConnectionMatchContext | undefined) {
  if (!matchContext) return {};
  return {
    matchCategory: matchContext.matchCategory,
    matchAirportIata: matchContext.matchAirportIata,
    matchFlightNumber: matchContext.matchFlightNumber,
    matchOverlapStartUtc: matchContext.matchOverlapStartUtc ? new Date(matchContext.matchOverlapStartUtc) : undefined,
    matchOverlapEndUtc: matchContext.matchOverlapEndUtc ? new Date(matchContext.matchOverlapEndUtc) : undefined,
  };
}
