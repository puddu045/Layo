import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  createAdminAccountRequestSchema,
  setAdminRoleRequestSchema,
  type CreateAdminAccountRequest,
  type SetAdminRoleRequest,
} from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/guards/supabase-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { AdminRolesService } from './admin-roles.service';

/** Only a `SUPER_ADMIN` can grant or revoke admin access — the one role-management
 * capability that has to be stricter than "any admin can do this". */
@Controller('admin-accounts')
@UseGuards(AdminGuard)
export class AdminRolesController {
  constructor(private readonly adminRolesService: AdminRolesService) {}

  @Get()
  list() {
    return this.adminRolesService.list();
  }

  @Post()
  @UseGuards(RoleGuard('SUPER_ADMIN'))
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createAccount(
    @CurrentUser() admin: RequestUser,
    @Body(new ZodValidationPipe(createAdminAccountRequestSchema)) dto: CreateAdminAccountRequest,
  ) {
    return this.adminRolesService.createAccount(admin.id, dto);
  }

  @Patch(':userId/role')
  @UseGuards(RoleGuard('SUPER_ADMIN'))
  setRole(
    @CurrentUser() admin: RequestUser,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(setAdminRoleRequestSchema)) dto: SetAdminRoleRequest,
  ) {
    return this.adminRolesService.setRole(admin.id, userId, dto);
  }
}
