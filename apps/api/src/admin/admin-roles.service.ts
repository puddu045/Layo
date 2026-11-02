import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { AdminAccount, CreateAdminAccountRequest, SetAdminRoleRequest } from '@layo/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class AdminRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async list(): Promise<AdminAccount[]> {
    const rows = await this.prisma.client.user.findMany({
      where: { isAdmin: true },
      include: { profile: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.profile?.displayName,
      role: (row.adminRole ?? 'MODERATOR') as AdminAccount['role'],
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /** Setting `role: null` revokes admin access entirely. A `SUPER_ADMIN` can't demote
   * themselves if they're the last one — the admin portal would otherwise be able to lock
   * every admin out of the roles screen that could undo it. */
  async setRole(
    actingAdminId: string,
    targetUserId: string,
    dto: SetAdminRoleRequest,
  ): Promise<{ id: string; email: string; role: AdminAccount['role'] | null }> {
    if (dto.role === null && targetUserId === actingAdminId) {
      const superAdminCount = await this.prisma.client.user.count({ where: { adminRole: 'SUPER_ADMIN' } });
      const actingUser = await this.prisma.client.user.findUnique({ where: { id: actingAdminId } });
      if (actingUser?.adminRole === 'SUPER_ADMIN' && superAdminCount <= 1) {
        throw new BadRequestException('You are the last Super Admin — promote another admin first');
      }
    }

    const row = await this.prisma.client.user.update({
      where: { id: targetUserId },
      data: { adminRole: dto.role, isAdmin: dto.role !== null },
      include: { profile: true },
    });

    await this.auditLogService.record(actingAdminId, 'SET_ADMIN_ROLE', 'User', targetUserId, { role: dto.role });

    return { id: row.id, email: row.email, role: row.adminRole as AdminAccount['role'] | null };
  }

  /** Creates a brand-new account that is an admin from the start — distinct from `setRole`,
   * which only promotes someone who has already signed up through the traveller app. Goes
   * through Supabase's admin API (service-role key, never exposed to any frontend) so the
   * account is created pre-confirmed, with no verification email to click through. */
  async createAccount(actingAdminId: string, dto: CreateAdminAccountRequest): Promise<AdminAccount> {
    const existingLocal = await this.prisma.client.user.findUnique({ where: { email: dto.email } });
    if (existingLocal) {
      throw new ConflictException('An account with this email already exists — use "Grant admin access" to promote it instead');
    }

    const { data, error } = await this.supabaseService.admin.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new ConflictException(error?.message ?? 'Could not create this account');
    }

    const row = await this.prisma.client.user.create({
      data: { id: data.user.id, email: dto.email, isAdmin: true, adminRole: dto.role },
    });

    await this.auditLogService.record(actingAdminId, 'CREATE_ADMIN_ACCOUNT', 'User', row.id, { email: dto.email, role: dto.role });

    return { id: row.id, email: row.email, role: dto.role, createdAt: row.createdAt.toISOString() };
  }
}
