import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DealStatus } from '@layo/db';
import { PrismaService } from '../common/prisma/prisma.service';

/** Flips approved deals whose `validUntil` has passed to `EXPIRED`, so admin/business listings
 * reflect reality without every reader having to compare dates themselves. The public-facing
 * `listForMe` query filters on `validUntil` directly either way, so this is about status accuracy
 * in the management UIs, not correctness of what travellers see. */
@Injectable()
export class DealExpiryService {
  private readonly logger = new Logger(DealExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async expireLapsedDeals(): Promise<number> {
    const result = await this.prisma.client.deal.updateMany({
      where: { status: DealStatus.APPROVED, validUntil: { lt: new Date() } },
      data: { status: DealStatus.EXPIRED },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} deal(s) past their validUntil date.`);
    }
    return result.count;
  }
}
