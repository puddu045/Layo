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
    const identity = await this.supabase.verifyAccessToken(token);
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

    const user = await this.prisma.client.user.upsert({
      where: { id: identity.id },
      create: { id: identity.id, email: identity.email },
      update: { email: identity.email },
    });

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('This account is no longer active');
    }

    const requestUser: RequestUser = { id: user.id, email: user.email, isAdmin: user.isAdmin };
    request.user = requestUser;
    return true;
  }
}
