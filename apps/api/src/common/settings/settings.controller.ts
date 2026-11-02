import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { updateSettingsRequestSchema, type UpdateSettingsRequest } from '@layo/contracts';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { RequestUser } from '../guards/supabase-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import { RoleGuard } from '../guards/role.guard';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('settings')
@UseGuards(AdminGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getAll() {
    return this.settingsService.getAll();
  }

  @Patch()
  @UseGuards(RoleGuard('SUPER_ADMIN'))
  update(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateSettingsRequestSchema)) dto: UpdateSettingsRequest,
  ) {
    return this.settingsService.update(user.id, dto);
  }
}

/** Separate controller for the audit log — a read model over `AuditLog`, surfaced under
 * Settings in the admin portal nav rather than its own top-level section. */
@Controller('audit-log')
@UseGuards(AdminGuard)
export class AuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('targetType') targetType?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
  ) {
    const rows = await this.prisma.client.auditLog.findMany({
      where: {
        ...(targetType && { targetType }),
        ...(action && { action }),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 50, 200),
    });
    const adminIds = [...new Set(rows.map((r) => r.actorAdminId).filter((id): id is string => !!id))];
    const admins = adminIds.length
      ? await this.prisma.client.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, email: true } })
      : [];
    const emailById = new Map(admins.map((a) => [a.id, a.email]));

    return rows.map((row) => ({
      id: row.id,
      actorAdminId: row.actorAdminId ?? undefined,
      actorEmail: row.actorAdminId ? emailById.get(row.actorAdminId) : undefined,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      metadata: (row.metadata as Record<string, unknown>) ?? undefined,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
