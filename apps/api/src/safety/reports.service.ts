import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateReportRequest, Report } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(reporterId: string, dto: CreateReportRequest): Promise<Report> {
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
    }

    if (dto.reportedRoomMessageId) {
      const roomMessage = await this.prisma.client.airportRoomMessage.findUnique({
        where: { id: dto.reportedRoomMessageId },
      });
      if (!roomMessage) throw new NotFoundException('Reported message not found');
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

    return { id: row.id, reason: row.reason as Report['reason'], status: row.status, createdAt: row.createdAt.toISOString() };
  }
}
