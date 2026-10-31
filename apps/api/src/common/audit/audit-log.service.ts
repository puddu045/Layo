import { Injectable } from '@nestjs/common';
import type { Prisma } from '@layo/db';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    actorAdminId: string,
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
