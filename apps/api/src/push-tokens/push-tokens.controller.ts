import { Body, Controller, Delete, Post } from '@nestjs/common';
import {
  registerPushTokenRequestSchema,
  unregisterPushTokenRequestSchema,
  type RegisterPushTokenRequest,
  type UnregisterPushTokenRequest,
} from '@layo/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/guards/supabase-auth.guard';
import { PushTokensService } from './push-tokens.service';

@Controller('push-tokens')
export class PushTokensController {
  constructor(private readonly pushTokensService: PushTokensService) {}

  @Post()
  register(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(registerPushTokenRequestSchema)) dto: RegisterPushTokenRequest,
  ) {
    return this.pushTokensService.register(user.id, dto.token, dto.platform);
  }

  /** Called on sign-out so a shared/reused device stops getting pushes meant for the account
   * that just signed out of it. Scoped to the caller's own token so one user can't unregister
   * another's by guessing a token value. */
  @Delete()
  unregister(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(unregisterPushTokenRequestSchema)) dto: UnregisterPushTokenRequest,
  ) {
    return this.pushTokensService.unregister(user.id, dto.token);
  }
}
