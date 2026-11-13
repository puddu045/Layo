import { Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { loadApiEnv } from '@layo/config';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

/**
 * Server-side Supabase client using the service-role key. Never expose this
 * key or this client to any frontend — it bypasses row-level security.
 */
@Injectable()
export class SupabaseService {
  readonly admin: SupabaseClient;
  private readonly jwtSecret: string;

  constructor() {
    const env = loadApiEnv();
    this.admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    this.jwtSecret = env.SUPABASE_JWT_SECRET;
  }

  /** Verifies a bearer access token's signature and expiry locally against the project's JWT
   * secret first — this used to call Supabase Auth's `getUser` API on every single request (and
   * every socket handshake), which meant every request in the app depended on a live round trip
   * to Supabase's own Auth service. Supabase's access tokens are HS256-signed with this secret
   * specifically so a backend can verify them without that call (this is Supabase's own
   * documented approach) — same guarantees (valid signature + not expired), no network hop.
   *
   * Falls back to the original remote check whenever local verification fails for *any* reason
   * — a wrong/stale `SUPABASE_JWT_SECRET`, or this project actually using Supabase's newer
   * asymmetric JWT Signing Keys instead of the legacy shared secret, would otherwise mean every
   * login fails outright with no way to tell which it was from the outside. This keeps auth
   * working (at the old, slower cost) in either case, and automatically gets fast again the
   * moment local verification actually succeeds — no further deploy needed once the secret/setup
   * is fixed. */
  async verifyAccessToken(accessToken: string): Promise<AuthenticatedUser | null> {
    const local = this.verifyAccessTokenLocally(accessToken);
    if (local) return local;
    return this.verifyAccessTokenRemotely(accessToken);
  }

  private verifyAccessTokenLocally(accessToken: string): AuthenticatedUser | null {
    try {
      const payload = jwt.verify(accessToken, this.jwtSecret, { algorithms: ['HS256'] });
      if (
        typeof payload !== 'object' ||
        payload.aud !== 'authenticated' ||
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string'
      ) {
        return null;
      }
      return { id: payload.sub, email: payload.email };
    } catch {
      return null;
    }
  }

  private async verifyAccessTokenRemotely(accessToken: string): Promise<AuthenticatedUser | null> {
    const { data, error } = await this.admin.auth.getUser(accessToken);
    if (error || !data.user?.email) return null;
    return { id: data.user.id, email: data.user.email };
  }
}
