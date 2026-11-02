import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminAirportRoom,
  AdminRoomMessage,
  AdminRoomMute,
  AirportRoomSummary,
  ListRoomMessagesQuery,
  LockRoomRequest,
  MuteUserRequest,
  RoomMessagePage,
} from '@layo/contracts';
import { socketEvents } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { computeUserRoomAccessWindows } from './room-eligibility';
import { findActiveOrNextWindow, findActiveWindow, type RoomAccessWindow } from './room-access.util';

@Injectable()
export class AirportRoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listMyRooms(userId: string): Promise<AirportRoomSummary[]> {
    const windows = await computeUserRoomAccessWindows(this.prisma, userId);
    const airportCodes = [...new Set(windows.map((w) => w.airportIata))];
    if (airportCodes.length === 0) return [];

    const [rooms, counts] = await Promise.all([
      this.prisma.client.airportRoom.findMany({ where: { airportIata: { in: airportCodes } } }),
      this.prisma.client.airportRoomMembership.groupBy({
        by: ['airportIata'],
        where: { airportIata: { in: airportCodes } },
        _count: { _all: true },
      }),
    ]);

    const now = new Date();
    const summaries = airportCodes.map((iata) => this.toSummary(iata, windows, rooms, counts, now));

    // Rooms you can actually use right now first, then soonest-opening next.
    return summaries.sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return (a.accessWindowStartUtc ?? '').localeCompare(b.accessWindowStartUtc ?? '');
    });
  }

  async getRoom(userId: string, airportIata: string): Promise<AirportRoomSummary> {
    const code = airportIata.toUpperCase();
    const windows = await computeUserRoomAccessWindows(this.prisma, userId);
    if (!windows.some((w) => w.airportIata === code)) {
      throw new NotFoundException('No journey of yours touches this airport');
    }

    const [room, count] = await Promise.all([
      this.prisma.client.airportRoom.findUnique({ where: { airportIata: code } }),
      this.prisma.client.airportRoomMembership.count({ where: { airportIata: code } }),
    ]);

    return this.toSummary(
      code,
      windows,
      room ? [room] : [],
      [{ airportIata: code, _count: { _all: count } }],
      new Date(),
    );
  }

  async listMessages(userId: string, airportIata: string, query: ListRoomMessagesQuery): Promise<RoomMessagePage> {
    const code = airportIata.toUpperCase();
    await this.requireEligible(userId, code);
    await this.touchMembership(userId, code);

    const rows = await this.prisma.client.airportRoomMessage.findMany({
      where: { airportIata: code, removedAt: null },
      orderBy: { createdAt: 'desc' },
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      include: { sender: { include: { profile: true } } },
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page.map(toRoomMessageDto),
      nextCursor: hasMore ? page[page.length - 1]!.id : undefined,
    };
  }

  async postMessage(userId: string, airportIata: string, body: string) {
    const code = airportIata.toUpperCase();
    await this.requireEligible(userId, code);
    await this.touchMembership(userId, code);

    const room = await this.prisma.client.airportRoom.findUnique({ where: { airportIata: code } });
    if (room?.locked) {
      throw new ForbiddenException(room.lockedReason ?? 'This airport chat is locked by a moderator');
    }

    const mute = await this.prisma.client.airportRoomMute.findUnique({
      where: { airportIata_userId: { airportIata: code, userId } },
    });
    if (mute && (!mute.mutedUntil || mute.mutedUntil > new Date())) {
      throw new ForbiddenException(
        mute.mutedUntil
          ? `You are muted in this room until ${mute.mutedUntil.toISOString()}`
          : 'You are muted in this room',
      );
    }

    const row = await this.prisma.client.airportRoomMessage.create({
      data: { airportIata: code, senderId: userId, body },
      include: { sender: { include: { profile: true } } },
    });

    const message = toRoomMessageDto(row);
    this.gateway.emitToRoom(code, socketEvents.ROOM_MESSAGE_NEW, message);
    return message;
  }

  private async requireEligible(userId: string, airportIata: string): Promise<RoomAccessWindow> {
    const windows = await computeUserRoomAccessWindows(this.prisma, userId);
    const now = new Date();
    const active = findActiveWindow(windows, airportIata, now);
    if (active) return active;

    const next = findActiveOrNextWindow(windows, airportIata, now);
    throw new ForbiddenException(
      next
        ? `This room isn't open for you yet — access starts ${next.start.toISOString()}`
        : 'You are not currently eligible for this airport room',
    );
  }

  private async touchMembership(userId: string, airportIata: string) {
    await this.prisma.client.airportRoomMembership.upsert({
      where: { airportIata_userId: { airportIata, userId } },
      create: { airportIata, userId },
      update: {},
    });
  }

  private toSummary(
    airportIata: string,
    windows: RoomAccessWindow[],
    rooms: Array<{ airportIata: string; name: string; description: string | null }>,
    counts: Array<{ airportIata: string; _count: { _all: number } }>,
    now: Date,
  ): AirportRoomSummary {
    const room = rooms.find((r) => r.airportIata === airportIata);
    const count = counts.find((c) => c.airportIata === airportIata)?._count._all ?? 0;
    const active = findActiveWindow(windows, airportIata, now);
    const window = findActiveOrNextWindow(windows, airportIata, now);

    return {
      airportIata,
      name: room?.name ?? `${airportIata} Airport Chat`,
      description: room?.description ?? undefined,
      participantCount: count,
      eligible: !!active,
      accessWindowStartUtc: window?.start.toISOString(),
      accessWindowEndUtc: window?.end.toISOString(),
    };
  }

  // -- Admin moderation -----------------------------------------------------------------

  async adminListRooms(): Promise<AdminAirportRoom[]> {
    const rooms = await this.prisma.client.airportRoom.findMany({ orderBy: { airportIata: 'asc' } });
    const airportCodes = rooms.map((r) => r.airportIata);

    const [participantCounts, messageCounts, reportedCounts] = await Promise.all([
      this.prisma.client.airportRoomMembership.groupBy({
        by: ['airportIata'],
        where: { airportIata: { in: airportCodes } },
        _count: { _all: true },
      }),
      this.prisma.client.airportRoomMessage.groupBy({
        by: ['airportIata'],
        where: { airportIata: { in: airportCodes }, removedAt: null },
        _count: { _all: true },
      }),
      this.prisma.client.report.groupBy({
        by: ['reportedRoomMessageId'],
        where: { reportedRoomMessageId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    // reportedRoomMessageId doesn't carry the airport directly — resolve the small set of
    // reported message ids back to their room in one query rather than N+1.
    const reportedMessageIds = reportedCounts.map((r) => r.reportedRoomMessageId).filter((id): id is string => !!id);
    const reportedMessages = reportedMessageIds.length
      ? await this.prisma.client.airportRoomMessage.findMany({
          where: { id: { in: reportedMessageIds } },
          select: { id: true, airportIata: true },
        })
      : [];
    const airportByMessageId = new Map(reportedMessages.map((m) => [m.id, m.airportIata]));
    const reportedCountByAirport = new Map<string, number>();
    for (const r of reportedCounts) {
      const airport = r.reportedRoomMessageId ? airportByMessageId.get(r.reportedRoomMessageId) : undefined;
      if (!airport) continue;
      reportedCountByAirport.set(airport, (reportedCountByAirport.get(airport) ?? 0) + r._count._all);
    }

    return rooms.map((room) => ({
      airportIata: room.airportIata,
      name: room.name,
      participantCount: participantCounts.find((c) => c.airportIata === room.airportIata)?._count._all ?? 0,
      messageCount: messageCounts.find((c) => c.airportIata === room.airportIata)?._count._all ?? 0,
      reportedMessageCount: reportedCountByAirport.get(room.airportIata) ?? 0,
      locked: room.locked,
      lockedReason: room.lockedReason ?? undefined,
    }));
  }

  async adminListMessages(airportIata: string): Promise<AdminRoomMessage[]> {
    const code = airportIata.toUpperCase();
    const rows = await this.prisma.client.airportRoomMessage.findMany({
      where: { airportIata: code },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { sender: { include: { profile: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      senderId: row.senderId,
      senderDisplayName: row.sender.profile?.displayName ?? 'Traveller',
      body: row.body,
      removed: !!row.removedAt,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async removeMessage(adminId: string, airportIata: string, messageId: string): Promise<void> {
    const code = airportIata.toUpperCase();
    const message = await this.prisma.client.airportRoomMessage.findUnique({ where: { id: messageId } });
    if (!message || message.airportIata !== code) throw new NotFoundException('Message not found');

    await this.prisma.client.airportRoomMessage.update({
      where: { id: messageId },
      data: { removedAt: new Date(), removedByAdminId: adminId },
    });
    await this.auditLogService.record(adminId, 'REMOVE_MESSAGE', 'AirportRoomMessage', messageId, { airportIata: code });
  }

  async lockRoom(adminId: string, airportIata: string, dto: LockRoomRequest): Promise<void> {
    const code = airportIata.toUpperCase();
    await this.prisma.client.airportRoom.upsert({
      where: { airportIata: code },
      create: { airportIata: code, name: `${code} Airport Chat`, locked: true, lockedReason: dto.reason },
      update: { locked: true, lockedReason: dto.reason },
    });
    await this.auditLogService.record(adminId, 'LOCK_ROOM', 'AirportRoom', code, { reason: dto.reason });
  }

  async unlockRoom(adminId: string, airportIata: string): Promise<void> {
    const code = airportIata.toUpperCase();
    await this.prisma.client.airportRoom.update({
      where: { airportIata: code },
      data: { locked: false, lockedReason: null },
    });
    await this.auditLogService.record(adminId, 'UNLOCK_ROOM', 'AirportRoom', code);
  }

  async muteUser(adminId: string, airportIata: string, dto: MuteUserRequest): Promise<void> {
    const code = airportIata.toUpperCase();
    const mutedUntil = dto.durationMinutes ? new Date(Date.now() + dto.durationMinutes * 60_000) : null;

    await this.prisma.client.airportRoomMute.upsert({
      where: { airportIata_userId: { airportIata: code, userId: dto.userId } },
      create: { airportIata: code, userId: dto.userId, mutedUntil, reason: dto.reason, mutedByAdminId: adminId },
      update: { mutedUntil, reason: dto.reason, mutedByAdminId: adminId },
    });
    await Promise.all([
      this.auditLogService.record(adminId, 'MUTE_USER', 'AirportRoomMute', `${code}:${dto.userId}`, {
        reason: dto.reason,
        mutedUntil,
      }),
      this.notificationsService.create(dto.userId, 'ROOM_MUTED', { airportIata: code, reason: dto.reason, mutedUntil }),
    ]);
  }

  async unmuteUser(adminId: string, airportIata: string, userId: string): Promise<void> {
    const code = airportIata.toUpperCase();
    await this.prisma.client.airportRoomMute.deleteMany({ where: { airportIata: code, userId } });
    await this.auditLogService.record(adminId, 'UNMUTE_USER', 'AirportRoomMute', `${code}:${userId}`);
  }

  async listMutes(airportIata: string): Promise<AdminRoomMute[]> {
    const code = airportIata.toUpperCase();
    const mutes = await this.prisma.client.airportRoomMute.findMany({ where: { airportIata: code } });
    if (mutes.length === 0) return [];

    const profiles = await this.prisma.client.profile.findMany({
      where: { userId: { in: mutes.map((m) => m.userId) } },
    });
    return mutes.map((m) => ({
      userId: m.userId,
      displayName: profiles.find((p) => p.userId === m.userId)?.displayName,
      mutedUntil: m.mutedUntil?.toISOString(),
      reason: m.reason ?? undefined,
    }));
  }
}

function toRoomMessageDto(row: {
  id: string;
  airportIata: string;
  senderId: string;
  body: string;
  createdAt: Date;
  sender: { profile: { displayName: string } | null };
}) {
  return {
    id: row.id,
    airportIata: row.airportIata,
    senderId: row.senderId,
    senderDisplayName: row.sender.profile?.displayName ?? 'Traveller',
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}
