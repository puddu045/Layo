import { Injectable, NotFoundException } from '@nestjs/common';
import type { Appeal, CreateAppealRequest, ListAppealsQuery, ResolveAppealRequest } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AppealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Unauthenticated by design: a suspended/banned account fails `SupabaseAuthGuard` before
   * reaching any controller, so this is the one way they can still be heard. */
  async create(dto: CreateAppealRequest): Promise<Appeal> {
    const row = await this.prisma.client.reportAppeal.create({
      data: { email: dto.email, message: dto.message },
    });
    return toAppeal(row);
  }

  async listAll(query: ListAppealsQuery): Promise<Appeal[]> {
    const rows = await this.prisma.client.reportAppeal.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toAppeal);
  }

  async resolve(adminId: string, appealId: string, dto: ResolveAppealRequest): Promise<Appeal> {
    const appeal = await this.prisma.client.reportAppeal.findUnique({ where: { id: appealId } });
    if (!appeal) throw new NotFoundException('Appeal not found');

    const row = await this.prisma.client.reportAppeal.update({
      where: { id: appealId },
      data: { status: dto.approve ? 'APPROVED' : 'DENIED', resolvedByAdminId: adminId, resolvedAt: new Date() },
    });

    await this.auditLogService.record(adminId, dto.approve ? 'APPROVE_APPEAL' : 'DENY_APPEAL', 'ReportAppeal', appealId);

    if (dto.approve) {
      const user = await this.prisma.client.user.findUnique({ where: { email: appeal.email } });
      if (user && user.status === 'SUSPENDED') {
        await this.usersService.applyModerationAction(adminId, user.id, 'REINSTATE', 'Appeal approved');
      }
    } else {
      const user = await this.prisma.client.user.findUnique({ where: { email: appeal.email } });
      if (user) {
        await this.notificationsService.create(user.id, 'APPEAL_RESOLVED', { approved: false });
      }
    }

    return toAppeal(row);
  }
}

function toAppeal(row: {
  id: string;
  email: string;
  message: string;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
}): Appeal {
  return {
    id: row.id,
    email: row.email,
    message: row.message,
    status: row.status as Appeal['status'],
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString(),
  };
}
