import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { RoleGuard } from './role.guard';
import type { RequestUser } from './supabase-auth.guard';

function contextWithUser(user: Partial<RequestUser> | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RoleGuard', () => {
  it('allows a user whose role is in the allowed list', () => {
    const guard = new (RoleGuard('MODERATOR'))();
    expect(guard.canActivate(contextWithUser({ adminRole: 'MODERATOR' }))).toBe(true);
  });

  it('denies a user whose role is not in the allowed list', () => {
    const guard = new (RoleGuard('MODERATOR'))();
    expect(() => guard.canActivate(contextWithUser({ adminRole: 'BUSINESS_MANAGER' }))).toThrow(ForbiddenException);
  });

  it('always allows SUPER_ADMIN, regardless of which roles are listed', () => {
    const guard = new (RoleGuard('BUSINESS_MANAGER'))();
    expect(guard.canActivate(contextWithUser({ adminRole: 'SUPER_ADMIN' }))).toBe(true);
  });

  it('denies a caller with no admin role at all', () => {
    const guard = new (RoleGuard('MODERATOR'))();
    expect(() => guard.canActivate(contextWithUser({ adminRole: undefined }))).toThrow(ForbiddenException);
  });

  it('denies when there is no user on the request', () => {
    const guard = new (RoleGuard('MODERATOR'))();
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(ForbiddenException);
  });
});
