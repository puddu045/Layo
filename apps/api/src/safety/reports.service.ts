import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReportStatus } from '@layo/db';
import type {
  AdminReportDetail,
  AdminReportListItem,
  AssignReportRequest,
  CreateReportRequest,
  ListReportsQuery,
  Report,
  ReportAction,
  ReportConversationMessage,
  ReportParty,
  ReportPriority,
  ReportReason,
} from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { SettingsService } from '../common/settings/settings.service';
import { UsersService } from '../users/users.service';
import { computeReportPriority } from './report-priority.util';

const CONVERSATION_MESSAGE_LIMIT = 50;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
    private readonly settingsService: SettingsService,
    private readonly usersService: UsersService,
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

  async listAll(query: ListReportsQuery): Promise<AdminReportListItem[]> {
    const rows = await this.prisma.client.report.findMany({
      where: {
        ...(query.status && { status: query.status }),
        ...(query.priority && { priority: query.priority }),
        ...(query.assignedAdminId && { assignedAdminId: query.assignedAdminId }),
      },
      // Most urgent first, then newest — a CRITICAL report filed yesterday should still
      // outrank a LOW one filed five minutes ago.
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        reporter: { include: { profile: true } },
        reportedUser: { include: { profile: true } },
      },
    });

    const assignedIds = [...new Set(rows.map((r) => r.assignedAdminId).filter((id): id is string => !!id))];
    const assignedAdmins = assignedIds.length
      ? await this.prisma.client.user.findMany({ where: { id: { in: assignedIds } }, select: { id: true, email: true } })
      : [];
    const emailByAdminId = new Map(assignedAdmins.map((a) => [a.id, a.email]));

    return rows.map((row) => ({
      id: row.id,
      reason: row.reason as AdminReportListItem['reason'],
      status: row.status,
      priority: row.priority as ReportPriority,
      assignedAdminId: row.assignedAdminId ?? undefined,
      assignedAdminEmail: row.assignedAdminId ? emailByAdminId.get(row.assignedAdminId) : undefined,
      reporter: toReportParty(row.reporter),
      reportedUser: row.reportedUser ? toReportParty(row.reportedUser) : undefined,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async assign(adminId: string, reportId: string, dto: AssignReportRequest): Promise<AdminReportDetail> {
    const report = await this.prisma.client.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');

    await this.prisma.client.report.update({
      where: { id: reportId },
      data: { assignedAdminId: dto.adminId },
    });
    await this.auditLogService.record(adminId, dto.adminId ? 'ASSIGN' : 'UNASSIGN', 'Report', reportId, {
      assignedAdminId: dto.adminId,
    });

    return this.getDetail(reportId);
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

    const [conversation, reportedUserTotalReporterCount, assignedAdmin] = await Promise.all([
      this.loadConversation(row),
      row.reportedUserId ? this.countDistinctReporters(row.reportedUserId) : Promise.resolve(undefined),
      row.assignedAdminId
        ? this.prisma.client.user.findUnique({ where: { id: row.assignedAdminId }, select: { email: true } })
        : Promise.resolve(undefined),
    ]);

    return {
      id: row.id,
      reason: row.reason as AdminReportDetail['reason'],
      status: row.status,
      priority: row.priority as ReportPriority,
      assignedAdminId: row.assignedAdminId ?? undefined,
      assignedAdminEmail: assignedAdmin?.email,
      reporter: toReportParty(row.reporter),
      reportedUser: row.reportedUser ? toReportParty(row.reportedUser) : undefined,
      details: row.details ?? undefined,
      reportedUserTotalReporterCount,
      conversation,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** `BAN` here is always a deliberate admin decision on a specific report — reached through
   * `UsersService.applyModerationAction`, the one place that knows how to ban a user, so this
   * never duplicates that logic. There is deliberately no path from report *count* alone to a
   * ban: `applyEscalation` below only ever raises priority/notifies, never bans. */
  async applyAction(adminId: string, reportId: string, action: ReportAction): Promise<AdminReportDetail> {
    const report = await this.prisma.client.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');

    if (action === 'BAN') {
      if (!report.reportedUserId) {
        throw new BadRequestException('This report has no specific user to ban');
      }
      await this.usersService.applyModerationAction(adminId, report.reportedUserId, 'BAN', `Banned from report ${reportId}`);
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

  /** Recomputes this reported user's priority across every one of their open reports and, at
   * the warning threshold, notifies them directly. Crossing the escalation threshold raises
   * priority to CRITICAL and notifies every admin so the case gets picked up — it never bans:
   * "never automatically ban based solely on report counts" is enforced by this function simply
   * not having a path to `UsersService.applyModerationAction('BAN', …)` at all. */
  private async applyEscalation(reportedUserId: string): Promise<void> {
    const [distinctReporterCount, moderationSettings] = await Promise.all([
      this.countDistinctReporters(reportedUserId),
      this.settingsService.getCategory('moderation'),
    ]);

    const openReports = await this.prisma.client.report.findMany({
      where: { reportedUserId, status: { not: ReportStatus.DISMISSED } },
      select: { id: true, reason: true },
    });

    await Promise.all(
      openReports.map((r) =>
        this.prisma.client.report.update({
          where: { id: r.id },
          data: {
            priority: computeReportPriority(r.reason as ReportReason, distinctReporterCount, moderationSettings),
          },
        }),
      ),
    );

    if (distinctReporterCount === moderationSettings.warningThreshold) {
      await this.notificationsService.create(reportedUserId, 'REPORT_WARNING', {
        reportCount: distinctReporterCount,
      });
    } else if (distinctReporterCount === moderationSettings.escalationThreshold) {
      await this.notificationsService.createForAdmins('REPORT_ESCALATED', {
        reportedUserId,
        reportCount: distinctReporterCount,
      });
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
