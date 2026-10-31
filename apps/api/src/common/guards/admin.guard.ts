import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestUser } from './supabase-auth.guard';

/** Route-level guard (`@UseGuards(AdminGuard)`) for admin-only endpoints. Runs after
 * `SupabaseAuthGuard`, which has already set `request.user`. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: RequestUser | undefined = request.user;
    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
