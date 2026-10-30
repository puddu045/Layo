import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '../guards/supabase-auth.guard';

/** Injects the authenticated user (set by `SupabaseAuthGuard`) into a controller method. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
