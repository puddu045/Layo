import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import {
  createProfileRequestSchema,
  updateProfileRequestSchema,
  type CreateProfileRequest,
  type UpdateProfileRequest,
} from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/guards/supabase-auth.guard';
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

  @Get('users/:userId/profile')
  async getPublicProfile(@Param('userId') userId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(userId)) {
      throw new NotFoundException('Profile not found');
    }
    return this.usersService.getPublicProfile(userId);
  }
}
