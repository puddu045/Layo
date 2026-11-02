import { Injectable } from '@nestjs/common';
import type { Prisma } from '@layo/db';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /** `actorAdminId` is null for an automated action (e.g. the report-threshold auto-ban) — still
   * worth logging, just with no admin to attribute it to. */
  async record(
    actorAdminId: string | null,
    action: string,
    targetType: string,
    targetId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.client.auditLog.create({
      data: { actorAdminId, action, targetType, targetId, metadata: metadata as Prisma.InputJsonValue },
    });
  }
}
