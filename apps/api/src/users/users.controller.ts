import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  createProfileRequestSchema,
  listAdminUsersQuerySchema,
  updatePhoneRequestSchema,
  updateProfileRequestSchema,
  userModerationRequestSchema,
  type CreateProfileRequest,
  type ListAdminUsersQuery,
  type UpdatePhoneRequest,
  type UpdateProfileRequest,
  type UserModerationRequest,
} from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/guards/supabase-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('me/profile')
  createProfile(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createProfileRequestSchema)) dto: CreateProfileRequest,
  ) {
    return this.usersService.createProfile(user.id, dto);
  }

  @Get('me/profile')
  getOwnProfile(@CurrentUser() user: RequestUser) {
    return this.usersService.getOwnProfile(user.id);
  }

  @Patch('me/profile')
  updateProfile(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateProfileRequestSchema)) dto: UpdateProfileRequest,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('me/phone')
  updatePhone(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updatePhoneRequestSchema)) dto: UpdatePhoneRequest,
  ) {
    return this.usersService.updatePhone(user.id, dto.phone);
  }

  @Delete('me')
  deleteOwnAccount(@CurrentUser() user: RequestUser) {
    return this.usersService.deleteOwnAccount(user.id);
  }

  @Get('users/:userId/profile')
  async getPublicProfile(@Param('userId') userId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(userId)) {
      throw new NotFoundException('Profile not found');
    }
    return this.usersService.getPublicProfile(userId);
  }

  // -- Admin: search, detail, moderation -------------------------------------------------

  @Get('users')
  @UseGuards(AdminGuard)
  listAdmin(@Query(new ZodValidationPipe(listAdminUsersQuerySchema)) query: ListAdminUsersQuery) {
    return this.usersService.listAdmin(query);
  }

  @Get('users/:userId/admin')
  @UseGuards(AdminGuard)
  getAdminDetail(@Param('userId') userId: string) {
    return this.usersService.getAdminDetail(userId);
  }

  @Patch('users/:userId/warn')
  @UseGuards(AdminGuard, RoleGuard('MODERATOR'))
  warn(
    @CurrentUser() admin: RequestUser,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(userModerationRequestSchema)) dto: UserModerationRequest,
  ) {
    return this.usersService.applyModerationAction(admin.id, userId, 'WARN', dto.reason);
  }

  @Patch('users/:userId/suspend')
  @UseGuards(AdminGuard, RoleGuard('MODERATOR'))
  suspend(
    @CurrentUser() admin: RequestUser,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(userModerationRequestSchema)) dto: UserModerationRequest,
  ) {
    return this.usersService.applyModerationAction(admin.id, userId, 'SUSPEND', dto.reason);
  }

  @Patch('users/:userId/ban')
  @UseGuards(AdminGuard, RoleGuard('MODERATOR'))
  ban(
    @CurrentUser() admin: RequestUser,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(userModerationRequestSchema)) dto: UserModerationRequest,
  ) {
    return this.usersService.applyModerationAction(admin.id, userId, 'BAN', dto.reason);
  }

  @Patch('users/:userId/reinstate')
  @UseGuards(AdminGuard, RoleGuard('MODERATOR'))
  reinstate(
    @CurrentUser() admin: RequestUser,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(userModerationRequestSchema)) dto: UserModerationRequest,
  ) {
    return this.usersService.applyModerationAction(admin.id, userId, 'REINSTATE', dto.reason);
  }

  @Patch('users/:userId/verify')
  @UseGuards(AdminGuard, RoleGuard('MODERATOR'))
  verify(@CurrentUser() admin: RequestUser, @Param('userId') userId: string) {
    return this.usersService.applyModerationAction(admin.id, userId, 'VERIFY');
  }

  @Patch('users/:userId/delete')
  @UseGuards(AdminGuard, RoleGuard('MODERATOR'))
  deleteUser(
    @CurrentUser() admin: RequestUser,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(userModerationRequestSchema)) dto: UserModerationRequest,
  ) {
    return this.usersService.applyModerationAction(admin.id, userId, 'DELETE', dto.reason);
  }
}
