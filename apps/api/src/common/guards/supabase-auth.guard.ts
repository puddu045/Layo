import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserStatus } from '@layo/db';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export interface RequestUser {
  id: string;
  email: string;
  isAdmin: boolean;
  /** Fine-grained admin tier (Admin Roles) — undefined for a non-admin. `isAdmin` alone still
   * gates every "any kind of admin" route; `RoleGuard` additionally checks this for routes
   * restricted to specific roles. A SUPER_ADMIN passes every `RoleGuard` check. */
  adminRole?: 'SUPER_ADMIN' | 'MODERATOR' | 'BUSINESS_MANAGER';
}

/**
 * Validates the `Authorization: Bearer <token>` header against Supabase Auth on
 * every request (global guard), then ensures a corresponding local `User` row
 * exists so the rest of the API can rely on `req.user.id` being a valid FK.
 *
 * Never trusts a client-supplied user id for anything — identity always comes
 * from this guard's verified token lookup.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);
    const identity = this.supabase.verifyAccessToken(token);
    if (!identity) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Checked before the upsert below, not after: a banned email re-signing up gets a brand new
    // Supabase auth user id, so `user.status` on a freshly-created local row would still read
    // ACTIVE — this is what actually stops them, by email, independent of that new id.
    const banned = await this.prisma.client.bannedIdentity.findUnique({
      where: { email: identity.email.toLowerCase() },
    });
    if (banned) {
      throw new UnauthorizedException('This account is banned');
    }

    // A plain findUnique, not an upsert, on the hot path: email practically never changes
    // between requests, so unconditionally upserting meant writing to Postgres (and bumping
    // `updatedAt`) on every single authenticated request in the app, for no actual change most
    // of the time. The write only happens below, for the two cases that actually need one.
    let user = await this.prisma.client.user.findUnique({ where: { id: identity.id } });
    if (!user) {
      user = await this.prisma.client.user.create({ data: { id: identity.id, email: identity.email } });
    } else if (user.email !== identity.email) {
      user = await this.prisma.client.user.update({ where: { id: identity.id }, data: { email: identity.email } });
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('This account is no longer active');
    }

    const requestUser: RequestUser = {
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      adminRole: user.adminRole ?? undefined,
    };
    request.user = requestUser;
    return true;
  }
}
