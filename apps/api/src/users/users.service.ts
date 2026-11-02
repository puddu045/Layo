import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@layo/db';
import type {
  AdminUserDetail,
  AdminUserListItem,
  CreateProfileRequest,
  ListAdminUsersQuery,
  OwnProfile,
  PaginatedResponse,
  UpdateProfileRequest,
  UserModerationAction,
} from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { toPublicProfile, type ProfileRow } from '../common/mappers/profile.mapper';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createProfile(userId: string, dto: CreateProfileRequest): Promise<OwnProfile> {
    const existing = await this.prisma.client.profile.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Profile already exists for this account');
    }

    if (dto.homeCityIata) {
      await this.assertAirportExists(dto.homeCityIata);
    }

    const profile = await this.prisma.client.profile.create({
      data: {
        userId,
        displayName: dto.displayName,
        dateOfBirth: new Date(`${dto.dateOfBirth}T00:00:00Z`),
        bio: dto.bio,
        interests: dto.interests,
        languages: dto.languages,
        homeCityIata: dto.homeCityIata,
        discoverable: dto.discoverable,
        photoUrl: dto.photoUrl,
      },
    });

    return this.toOwnProfile(profile);
  }

  async updateProfile(userId: string, dto: UpdateProfileRequest): Promise<OwnProfile> {
    const existing = await this.prisma.client.profile.findUnique({ where: { userId } });
    if (!existing) {
      throw new NotFoundException('Profile not found — complete profile setup first');
    }

    if (dto.homeCityIata) {
      await this.assertAirportExists(dto.homeCityIata);
    }

    const profile = await this.prisma.client.profile.update({
      where: { userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(`${dto.dateOfBirth}T00:00:00Z`) }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.interests !== undefined && { interests: dto.interests }),
        ...(dto.languages !== undefined && { languages: dto.languages }),
        ...(dto.homeCityIata !== undefined && { homeCityIata: dto.homeCityIata }),
        ...(dto.discoverable !== undefined && { discoverable: dto.discoverable }),
        ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
      },
    });

    return this.toOwnProfile(profile);
  }

  async getOwnProfile(userId: string): Promise<OwnProfile> {
    const profile = await this.prisma.client.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found — complete profile setup first');
    return this.toOwnProfile(profile);
  }

  /** Public-facing view: never includes date of birth or any contact detail. */
  async getPublicProfile(userId: string): Promise<ReturnType<typeof toPublicProfile>> {
    const profile = await this.prisma.client.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');
    return toPublicProfile(profile);
  }

  /** Soft-deletes the account: flips `status` away from `ACTIVE` so `SupabaseAuthGuard` rejects
   * the caller's next request, and every existing `status: 'ACTIVE'` filter (matching, discover)
   * already stops surfacing them. Rows are kept, not erased — consistent with every other delete
   * in this codebase (journeys, connections) being a real decision, not a default to revisit. */
  async deleteOwnAccount(userId: string): Promise<{ success: true }> {
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { status: 'DELETED', deletedAt: new Date() },
    });
    return { success: true };
  }

  // -- Admin: search, profile detail, moderation --------------------------------------------

  async listAdmin(query: ListAdminUsersQuery): Promise<PaginatedResponse<AdminUserListItem>> {
    const where = {
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { email: { contains: query.search, mode: 'insensitive' as const } },
          { profile: { displayName: { contains: query.search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.client.user.findMany({
        where,
        include: { profile: true, _count: { select: { reportsReceived: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.client.user.count({ where }),
    ]);

    return {
      items: rows.map(toAdminUserListItem),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async getAdminDetail(userId: string): Promise<AdminUserDetail> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: { profile: true, _count: { select: { reportsReceived: true } } },
    });
    if (!user) throw new NotFoundException('User not found');

    const [journeysCount, connectionsCount, reportsFiledCount, blocksInitiatedCount, historyRows] =
      await Promise.all([
        this.prisma.client.journey.count({ where: { userId } }),
        this.prisma.client.connection.count({ where: { OR: [{ requesterId: userId }, { addresseeId: userId }] } }),
        this.prisma.client.report.count({ where: { reporterId: userId } }),
        this.prisma.client.block.count({ where: { blockerId: userId } }),
        this.prisma.client.auditLog.findMany({
          where: { targetType: 'User', targetId: userId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

    const actorIds = [...new Set(historyRows.map((r) => r.actorAdminId).filter((id): id is string => !!id))];
    const actors = actorIds.length
      ? await this.prisma.client.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } })
      : [];
    const emailByActorId = new Map(actors.map((a) => [a.id, a.email]));

    return {
      ...toAdminUserListItem(user),
      journeysCount,
      connectionsCount,
      reportsFiledCount,
      blocksInitiatedCount,
      history: historyRows.map((row) => ({
        id: row.id,
        actorAdminId: row.actorAdminId ?? undefined,
        actorEmail: row.actorAdminId ? emailByActorId.get(row.actorAdminId) : undefined,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        metadata: (row.metadata as Record<string, unknown>) ?? undefined,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  /** Shared entry point for every user-moderation action, whether triggered by an admin from
   * the Users module or by `ReportsService` acting on a resolved report — one place that knows
   * how to warn/suspend/ban/reinstate/verify a user, so the two call sites can't drift. */
  async applyModerationAction(
    adminId: string | null,
    userId: string,
    action: UserModerationAction,
    reason?: string,
  ): Promise<void> {
    const user = await this.prisma.client.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    switch (action) {
      case 'WARN':
        await this.notificationsService.create(userId, 'REPORT_WARNING', { reason });
        break;
      case 'SUSPEND':
        await this.prisma.client.user.update({ where: { id: userId }, data: { status: UserStatus.SUSPENDED } });
        await this.notificationsService.create(userId, 'ACCOUNT_SUSPENDED', { reason, permanent: false });
        break;
      case 'BAN':
        await this.prisma.client.user.update({ where: { id: userId }, data: { status: UserStatus.SUSPENDED } });
        await this.prisma.client.bannedIdentity.upsert({
          where: { email: user.email },
          create: { email: user.email, reason, bannedByAdminId: adminId ?? undefined },
          update: { reason, bannedByAdminId: adminId ?? undefined, bannedAt: new Date() },
        });
        await this.notificationsService.create(userId, 'ACCOUNT_SUSPENDED', { reason, permanent: true });
        break;
      case 'REINSTATE':
        if (user.status !== UserStatus.SUSPENDED) {
          throw new BadRequestException('Only a suspended or banned user can be reinstated');
        }
        await this.prisma.client.user.update({ where: { id: userId }, data: { status: UserStatus.ACTIVE } });
        await this.prisma.client.bannedIdentity.deleteMany({ where: { email: user.email } });
        await this.notificationsService.create(userId, 'ACCOUNT_REINSTATED', { reason });
        break;
      case 'VERIFY':
        await this.prisma.client.user.update({ where: { id: userId }, data: { verifiedAt: new Date() } });
        await this.notificationsService.create(userId, 'ACCOUNT_VERIFIED', {});
        break;
    }

    await this.auditLogService.record(adminId, action, 'User', userId, { reason });
  }

  private async assertAirportExists(iataCode: string) {
    const airport = await this.prisma.client.airport.findUnique({ where: { iataCode } });
    if (!airport) throw new NotFoundException(`Unknown airport code: ${iataCode}`);
  }

  private toOwnProfile(
    profile: ProfileRow & { discoverable: boolean; createdAt: Date; updatedAt: Date },
  ): OwnProfile {
    return {
      ...toPublicProfile(profile),
      dateOfBirth: profile.dateOfBirth.toISOString().slice(0, 10),
      discoverable: profile.discoverable,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}

function toAdminUserListItem(user: {
  id: string;
  email: string;
  status: string;
  isAdmin: boolean;
  adminRole: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  profile: { displayName: string } | null;
  _count: { reportsReceived: number };
}): AdminUserListItem {
  return {
    id: user.id,
    email: user.email,
    displayName: user.profile?.displayName,
    status: user.status as AdminUserListItem['status'],
    isAdmin: user.isAdmin,
    adminRole: (user.adminRole as AdminUserListItem['adminRole']) ?? undefined,
    verifiedAt: user.verifiedAt?.toISOString(),
    reportsReceivedCount: user._count.reportsReceived,
    createdAt: user.createdAt.toISOString(),
  };
}
