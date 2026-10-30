import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { BlockedUser } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class BlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async block(userId: string, blockedUserId: string): Promise<{ success: true }> {
    if (userId === blockedUserId) {
      throw new BadRequestException('You cannot block yourself');
    }

    const target = await this.prisma.client.user.findUnique({ where: { id: blockedUserId } });
    if (!target) throw new NotFoundException('User not found');

    await this.prisma.client.block.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: blockedUserId } },
      create: { blockerId: userId, blockedId: blockedUserId },
      update: {},
    });

    return { success: true };
  }

  async unblock(userId: string, blockedUserId: string): Promise<{ success: true }> {
    await this.prisma.client.block.deleteMany({
      where: { blockerId: userId, blockedId: blockedUserId },
    });
    return { success: true };
  }

  async list(userId: string): Promise<BlockedUser[]> {
    const blocks = await this.prisma.client.block.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: 'desc' },
    });
    if (blocks.length === 0) return [];

    const profiles = await this.prisma.client.profile.findMany({
      where: { userId: { in: blocks.map((b) => b.blockedId) } },
    });

    return blocks.map((b) => ({
      blockedUserId: b.blockedId,
      displayName: profiles.find((p) => p.userId === b.blockedId)?.displayName ?? 'Unknown traveller',
      createdAt: b.createdAt.toISOString(),
    }));
  }

  /** Used by other modules (messaging, connections) to check a single pair in either direction. */
  async isBlockedEitherWay(userIdA: string, userIdB: string): Promise<boolean> {
    const block = await this.prisma.client.block.findFirst({
      where: {
        OR: [
          { blockerId: userIdA, blockedId: userIdB },
          { blockerId: userIdB, blockedId: userIdA },
        ],
      },
    });
    return !!block;
  }

  /** Used by matching to filter many candidates against one user's blocks in a single query. */
  async getBlockedUserIdSet(userId: string): Promise<Set<string>> {
    const blocks = await this.prisma.client.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    });
    const ids = new Set<string>();
    for (const b of blocks) {
      ids.add(b.blockerId === userId ? b.blockedId : b.blockerId);
    }
    return ids;
  }
}
