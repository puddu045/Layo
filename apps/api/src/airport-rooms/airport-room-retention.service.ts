import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { loadApiEnv } from '@layo/config';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Airport rooms are long-lived and can accumulate a lot of traffic, so
 * messages are pruned after `AIRPORT_ROOM_MESSAGE_RETENTION_DAYS` (default
 * 90) rather than kept forever. This only deletes room chat messages —
 * never private `Message` rows, which have no retention policy.
 */
@Injectable()
export class AirportRoomRetentionService {
  private readonly logger = new Logger(AirportRoomRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async pruneOldMessages(): Promise<number> {
    const env = loadApiEnv();
    const cutoff = new Date(Date.now() - env.AIRPORT_ROOM_MESSAGE_RETENTION_DAYS * 24 * 3_600_000);

    const result = await this.prisma.client.airportRoomMessage.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    if (result.count > 0) {
      this.logger.log(`Pruned ${result.count} airport room message(s) older than ${cutoff.toISOString()}`);
    }
    return result.count;
  }
}
