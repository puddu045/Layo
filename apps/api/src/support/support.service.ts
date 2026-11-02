import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateSupportReplyRequest,
  CreateSupportTicketRequest,
  ListSupportTicketsQuery,
  SupportTicketDetail,
  SupportTicketListItem,
  UpdateSupportTicketStatusRequest,
} from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(userId: string | undefined, userEmail: string | undefined, dto: CreateSupportTicketRequest) {
    const email = userEmail ?? dto.email;
    if (!email) throw new BadRequestException('email is required when not signed in');

    const row = await this.prisma.client.supportTicket.create({
      data: { userId, email, subject: dto.subject, body: dto.body, category: dto.category },
    });
    return this.getDetail(row.id);
  }

  async listAll(query: ListSupportTicketsQuery): Promise<SupportTicketListItem[]> {
    const rows = await this.prisma.client.supportTicket.findMany({
      where: {
        ...(query.status && { status: query.status }),
        ...(query.category && { category: query.category }),
      },
      include: { _count: { select: { replies: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    const displayNameByUserId = await this.resolveDisplayNames(rows.map((r) => r.userId));
    return rows.map((row) => toListItem(row, displayNameByUserId.get(row.userId ?? '')));
  }

  async getDetail(ticketId: string): Promise<SupportTicketDetail> {
    const row = await this.prisma.client.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        _count: { select: { replies: true } },
        replies: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('Support ticket not found');

    const [adminEmailById, displayNameByUserId] = await Promise.all([
      this.resolveAdminEmails(row.replies.map((r) => r.authorAdminId)),
      this.resolveDisplayNames([row.userId]),
    ]);
    const authorDisplayName = displayNameByUserId.get(row.userId ?? '');

    return {
      ...toListItem(row, authorDisplayName),
      body: row.body,
      replies: row.replies.map((r) => ({
        id: r.id,
        body: r.body,
        isAdmin: !!r.authorAdminId,
        authorLabel: r.authorAdminId ? adminEmailById.get(r.authorAdminId) ?? 'Admin' : authorDisplayName ?? row.email,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  private async resolveDisplayNames(userIds: Array<string | null>): Promise<Map<string, string>> {
    const ids = [...new Set(userIds.filter((id): id is string => !!id))];
    if (ids.length === 0) return new Map();
    const profiles = await this.prisma.client.profile.findMany({ where: { userId: { in: ids } } });
    return new Map(profiles.map((p) => [p.userId, p.displayName]));
  }

  private async resolveAdminEmails(adminIds: Array<string | null>): Promise<Map<string, string>> {
    const ids = [...new Set(adminIds.filter((id): id is string => !!id))];
    if (ids.length === 0) return new Map();
    const admins = await this.prisma.client.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } });
    return new Map(admins.map((a) => [a.id, a.email]));
  }

  async updateStatus(ticketId: string, dto: UpdateSupportTicketStatusRequest): Promise<SupportTicketDetail> {
    const existing = await this.prisma.client.supportTicket.findUnique({ where: { id: ticketId } });
    if (!existing) throw new NotFoundException('Support ticket not found');

    await this.prisma.client.supportTicket.update({ where: { id: ticketId }, data: { status: dto.status } });
    return this.getDetail(ticketId);
  }

  async reply(adminId: string, ticketId: string, dto: CreateSupportReplyRequest): Promise<SupportTicketDetail> {
    const ticket = await this.prisma.client.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Support ticket not found');

    await this.prisma.client.supportReply.create({
      data: { ticketId, authorAdminId: adminId, body: dto.body },
    });
    await this.prisma.client.supportTicket.update({
      where: { id: ticketId },
      data: { status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status },
    });

    if (ticket.userId) {
      await this.notificationsService.create(ticket.userId, 'SUPPORT_REPLY', { ticketId });
    }

    return this.getDetail(ticketId);
  }
}

function toListItem(
  row: {
    id: string;
    email: string;
    subject: string;
    category: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    _count: { replies: number };
  },
  userDisplayName: string | undefined,
): SupportTicketListItem {
  return {
    id: row.id,
    email: row.email,
    userDisplayName,
    subject: row.subject,
    category: row.category as SupportTicketListItem['category'],
    status: row.status as SupportTicketListItem['status'],
    replyCount: row._count.replies,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
