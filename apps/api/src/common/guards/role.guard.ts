import { CanActivate, ExecutionContext, ForbiddenException, mixin, type Type } from '@nestjs/common';
import type { AdminRole } from '@layo/contracts';
import type { RequestUser } from './supabase-auth.guard';

/**
 * Route-level guard factory for admin routes restricted to specific roles, e.g.
 * `@UseGuards(AdminGuard, RoleGuard('SUPER_ADMIN', 'MODERATOR'))`. Always run after
 * `AdminGuard` (which already confirmed `isAdmin`) — this only narrows further.
 * `SUPER_ADMIN` always passes, regardless of which roles are listed.
 */
export function RoleGuard(...allowed: AdminRole[]): Type<CanActivate> {
  class RoleGuardMixin implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest();
      const user: RequestUser | undefined = request.user;
      const role = user?.adminRole;
      if (role === 'SUPER_ADMIN' || (role && allowed.includes(role))) {
        return true;
      }
      throw new ForbiddenException(`Requires one of these admin roles: ${allowed.join(', ')}`);
    }
  }
  return mixin(RoleGuardMixin);
}
