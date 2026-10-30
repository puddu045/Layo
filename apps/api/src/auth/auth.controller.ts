import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/guards/supabase-auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Confirms the caller's token is valid and whether they still need to complete profile setup. */
  @Get('me')
  async me(@CurrentUser() user: RequestUser) {
    const hasProfile = await this.authService.hasProfile(user.id);
    return { id: user.id, email: user.email, isAdmin: user.isAdmin, hasProfile };
  }
}
