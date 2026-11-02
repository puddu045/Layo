import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReportStatus, UserStatus } from '@layo/db';
import type {
  AdminReportDetail,
  AdminReportListItem,
  CreateReportRequest,
  Report,
  ReportAction,
  ReportConversationMessage,
  ReportParty,
} from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../common/audit/audit-log.service';

// "Three users" / "ten users" in the original ask means distinct reporters, not raw report
// rows — otherwise one person filing repeat reports could trigger escalation alone.
const WARNING_THRESHOLD = 3;
const BAN_THRESHOLD = 10;
const CONVERSATION_MESSAGE_LIMIT = 50;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(reporterId: string, dto: CreateReportRequest): Promise<Report> {
    let reportedUserId = dto.reportedUserId;

    if (dto.reportedUserId) {
      const target = await this.prisma.client.user.findUnique({ where: { id: dto.reportedUserId } });
      if (!target) throw new NotFoundException('Reported user not found');
    }

    if (dto.reportedMessageId) {
      const message = await this.prisma.client.message.findUnique({
        where: { id: dto.reportedMessageId },
        include: { connection: true },
      });
      if (!message) throw new NotFoundException('Reported message not found');
      const isParticipant =
        message.connection.requesterId === reporterId || message.connection.addresseeId === reporterId;
      if (!isParticipant) {
        throw new ForbiddenException('You can only report messages in your own conversations');
      }
      // A message report always implicates its sender, even if the client didn't also pass
      // reportedUserId — escalation should still count toward that person.
      reportedUserId = reportedUserId ?? message.senderId;
    }

    if (dto.reportedRoomMessageId) {
      const roomMessage = await this.prisma.client.airportRoomMessage.findUnique({
        where: { id: dto.reportedRoomMessageId },
      });
      if (!roomMessage) throw new NotFoundException('Reported message not found');
      reportedUserId = reportedUserId ?? roomMessage.senderId;
    }

    const row = await this.prisma.client.report.create({
      data: {
        reporterId,
        reportedUserId: dto.reportedUserId,
        reportedMessageId: dto.reportedMessageId,
        reportedRoomMessageId: dto.reportedRoomMessageId,
        reason: dto.reason,
        details: dto.details,
      },
    });

    if (reportedUserId) {
      await this.applyEscalation(reportedUserId);
    }

    return {
      id: row.id,
      reason: row.reason as Report['reason'],
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async listAll(status?: ReportStatus): Promise<AdminReportListItem[]> {
    const rows = await this.prisma.client.report.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { include: { profile: true } },
        reportedUser: { include: { profile: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      reason: row.reason as AdminReportListItem['reason'],
      status: row.status,
      reporter: toReportParty(row.reporter),
      reportedUser: row.reportedUser ? toReportParty(row.reportedUser) : undefined,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getDetail(reportId: string): Promise<AdminReportDetail> {
    const row = await this.prisma.client.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: { include: { profile: true } },
        reportedUser: { include: { profile: true } },
      },
    });
    if (!row) throw new NotFoundException('Report not found');

    const [conversation, reportedUserTotalReporterCount] = await Promise.all([
      this.loadConversation(row),
      row.reportedUserId ? this.countDistinctReporters(row.reportedUserId) : Promise.resolve(undefined),
    ]);

    return {
      id: row.id,
      reason: row.reason as AdminReportDetail['reason'],
      status: row.status,
      reporter: toReportParty(row.reporter),
      reportedUser: row.reportedUser ? toReportParty(row.reportedUser) : undefined,
      details: row.details ?? undefined,
      reportedUserTotalReporterCount,
      conversation,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async applyAction(adminId: string, reportId: string, action: ReportAction): Promise<AdminReportDetail> {
    const report = await this.prisma.client.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');

    if (action === 'BAN') {
      if (!report.reportedUserId) {
        throw new BadRequestException('This report has no specific user to ban');
      }
      await this.banUser(report.reportedUserId, adminId, `Banned from report ${reportId}`);
    }

    await this.prisma.client.report.update({
      where: { id: reportId },
      data: {
        status: action === 'REVIEW' ? ReportStatus.REVIEWED : action === 'DISMISS' ? ReportStatus.DISMISSED : ReportStatus.ACTIONED,
        resolvedByAdminId: adminId,
        resolvedAt: new Date(),
      },
    });

    await this.auditLogService.record(adminId, action, 'Report', reportId);

    return this.getDetail(reportId);
  }

  /** Shared by the automatic report-threshold ban and an admin's manual "Ban user" action —
   * `actorAdminId` is null for the automated path, which the nullable AuditLog/BannedIdentity
   * actor columns exist specifically to support. */
  async banUser(targetUserId: string, actorAdminId: string | null, reason: string): Promise<void> {
    const user = await this.prisma.client.user.update({
      where: { id: targetUserId },
      data: { status: UserStatus.SUSPENDED },
    });

    await Promise.all([
      this.prisma.client.bannedIdentity.upsert({
        where: { email: user.email },
        create: { email: user.email, reason, bannedByAdminId: actorAdminId ?? undefined },
        update: { reason, bannedByAdminId: actorAdminId ?? undefined, bannedAt: new Date() },
      }),
      this.notificationsService.create(targetUserId, 'ACCOUNT_SUSPENDED', { reason }),
      this.auditLogService.record(actorAdminId, 'BAN', 'User', targetUserId, { reason }),
    ]);
  }

  private async applyEscalation(reportedUserId: string): Promise<void> {
    const distinctReporterCount = await this.countDistinctReporters(reportedUserId);

    if (distinctReporterCount === WARNING_THRESHOLD) {
      await this.notificationsService.create(reportedUserId, 'REPORT_WARNING', {
        reportCount: distinctReporterCount,
      });
    } else if (distinctReporterCount >= BAN_THRESHOLD) {
      const user = await this.prisma.client.user.findUnique({ where: { id: reportedUserId } });
      if (user && user.status === UserStatus.ACTIVE) {
        await this.banUser(reportedUserId, null, `Automatically banned after ${distinctReporterCount} reports`);
      }
    }
  }

  /** Dismissed reports don't count — an admin has already decided those weren't valid. */
  private async countDistinctReporters(reportedUserId: string): Promise<number> {
    const reports = await this.prisma.client.report.findMany({
      where: { reportedUserId, status: { not: ReportStatus.DISMISSED } },
      select: { reporterId: true },
    });
    return new Set(reports.map((r) => r.reporterId)).size;
  }

  private async loadConversation(report: {
    reportedMessageId: string | null;
    reportedRoomMessageId: string | null;
    reporterId: string;
    reportedUserId: string | null;
  }): Promise<ReportConversationMessage[]> {
    if (report.reportedMessageId) {
      const message = await this.prisma.client.message.findUnique({ where: { id: report.reportedMessageId } });
      if (!message) return [];
      return this.loadConnectionMessages(message.connectionId);
    }

    if (report.reportedRoomMessageId) {
      const roomMessage = await this.prisma.client.airportRoomMessage.findUnique({
        where: { id: report.reportedRoomMessageId },
      });
      if (!roomMessage) return [];
      return this.loadRoomMessages(roomMessage.airportIata);
    }

    if (report.reportedUserId) {
      const connection = await this.prisma.client.connection.findFirst({
        where: {
          OR: [
            { requesterId: report.reporterId, addresseeId: report.reportedUserId },
            { requesterId: report.reportedUserId, addresseeId: report.reporterId },
          ],
        },
      });
      if (connection) return this.loadConnectionMessages(connection.id);
    }

    return [];
  }

  private async loadConnectionMessages(connectionId: string): Promise<ReportConversationMessage[]> {
    const rows = await this.prisma.client.message.findMany({
      where: { connectionId },
      orderBy: { createdAt: 'desc' },
      take: CONVERSATION_MESSAGE_LIMIT,
      include: { sender: { include: { profile: true } } },
    });
    return rows.reverse().map(toConversationMessage);
  }

  private async loadRoomMessages(airportIata: string): Promise<ReportConversationMessage[]> {
    const rows = await this.prisma.client.airportRoomMessage.findMany({
      where: { airportIata },
      orderBy: { createdAt: 'desc' },
      take: CONVERSATION_MESSAGE_LIMIT,
      include: { sender: { include: { profile: true } } },
    });
    return rows.reverse().map(toConversationMessage);
  }
}

function toReportParty(user: { id: string; email: string; profile: { displayName: string } | null }): ReportParty {
  return { id: user.id, email: user.email, displayName: user.profile?.displayName };
}

function toConversationMessage(row: {
  id: string;
  senderId: string;
  body: string;
  createdAt: Date;
  sender: { email: string; profile: { displayName: string } | null };
}): ReportConversationMessage {
  return {
    id: row.id,
    senderId: row.senderId,
    senderDisplayName: row.sender.profile?.displayName ?? row.sender.email,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}
