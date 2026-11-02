import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AnnouncementStatus } from '@layo/db';
import type { Announcement, CreateAnnouncementRequest } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(adminId: string, dto: CreateAnnouncementRequest): Promise<Announcement> {
    const isDue = !dto.scheduledAt || new Date(dto.scheduledAt) <= new Date();

    const row = await this.prisma.client.announcement.create({
      data: {
        title: dto.title,
        body: dto.body,
        audience: dto.audience,
        targetAirportIata: dto.targetAirportIata,
        targetUserIds: dto.targetUserIds ?? [],
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        createdByAdminId: adminId,
        ...(isDue && { status: AnnouncementStatus.SENT, sentAt: new Date() }),
      },
    });

    if (isDue) {
      await this.send(row);
    }
    await this.auditLogService.record(adminId, 'CREATE_ANNOUNCEMENT', 'Announcement', row.id, { audience: dto.audience });

    return toAnnouncement(row);
  }

  async listAll(): Promise<Announcement[]> {
    const rows = await this.prisma.client.announcement.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toAnnouncement);
  }

  async cancel(adminId: string, id: string): Promise<void> {
    const row = await this.prisma.client.announcement.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Announcement not found');
    if (row.status !== AnnouncementStatus.SCHEDULED) {
      throw new NotFoundException('Only a still-scheduled announcement can be cancelled');
    }
    await this.prisma.client.announcement.update({ where: { id }, data: { status: AnnouncementStatus.CANCELLED } });
    await this.auditLogService.record(adminId, 'CANCEL_ANNOUNCEMENT', 'Announcement', id);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async sendDueAnnouncements(): Promise<number> {
    const due = await this.prisma.client.announcement.findMany({
      where: { status: AnnouncementStatus.SCHEDULED, scheduledAt: { lte: new Date() } },
    });
    for (const row of due) {
      await this.send(row);
      await this.prisma.client.announcement.update({
        where: { id: row.id },
        data: { status: AnnouncementStatus.SENT, sentAt: new Date() },
      });
    }
    if (due.length > 0) this.logger.log(`Sent ${due.length} scheduled announcement(s)`);
    return due.length;
  }

  private async send(row: { id: string; title: string; body: string; audience: string; targetAirportIata: string | null; targetUserIds: string[] }): Promise<void> {
    const payload = { announcementId: row.id, title: row.title, body: row.body };

    if (row.audience === 'ALL') {
      const users = await this.prisma.client.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
      await Promise.all(users.map((u) => this.notificationsService.create(u.id, 'ANNOUNCEMENT', payload)));
    } else if (row.audience === 'BY_AIRPORT' && row.targetAirportIata) {
      const memberships = await this.prisma.client.airportRoomMembership.findMany({
        where: { airportIata: row.targetAirportIata },
        select: { userId: true },
      });
      await Promise.all(memberships.map((m) => this.notificationsService.create(m.userId, 'ANNOUNCEMENT', payload)));
    } else if (row.audience === 'SPECIFIC_USERS') {
      await Promise.all(row.targetUserIds.map((userId) => this.notificationsService.create(userId, 'ANNOUNCEMENT', payload)));
    }
  }
}

function toAnnouncement(row: {
  id: string;
  title: string;
  body: string;
  audience: string;
  targetAirportIata: string | null;
  targetUserIds: string[];
  scheduledAt: Date | null;
  sentAt: Date | null;
  status: string;
  createdAt: Date;
}): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience as Announcement['audience'],
    targetAirportIata: row.targetAirportIata ?? undefined,
    targetUserIds: row.targetUserIds,
    scheduledAt: row.scheduledAt?.toISOString(),
    sentAt: row.sentAt?.toISOString(),
    status: row.status as Announcement['status'],
    createdAt: row.createdAt.toISOString(),
  };
}
