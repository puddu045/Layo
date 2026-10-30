import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { socketEvents, type AirportRoomSummary, type ListRoomMessagesQuery, type RoomMessagePage } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { computeUserRoomAccessWindows } from './room-eligibility';
import { findActiveOrNextWindow, findActiveWindow, type RoomAccessWindow } from './room-access.util';

@Injectable()
export class AirportRoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
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
      where: { airportIata: code },
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
