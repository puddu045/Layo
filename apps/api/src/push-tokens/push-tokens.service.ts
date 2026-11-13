import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class PushTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /** Upsert by token, not by userId: the same device keeps the same Expo push token across
   * sign-ins, so logging in as a different user on it re-points this row's `userId` instead of
   * leaving a stale one that would otherwise wrongly keep notifying the previous account. */
  async register(userId: string, token: string, platform: string): Promise<void> {
    await this.prisma.client.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  async unregister(userId: string, token: string): Promise<void> {
    await this.prisma.client.pushToken.deleteMany({ where: { token, userId } });
  }
}
