import { Injectable, Logger } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
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
  private readonly logger = new Logger(SupabaseService.name);
  readonly admin: SupabaseClient;
  private readonly jwks: JWTVerifyGetKey;

  constructor() {
    const env = loadApiEnv();
    this.admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // This project's current signing method (and the default for any Supabase project created
    // recently enough) is an ES256 key pair under "JWT Signing Keys" in the dashboard, not the
    // legacy shared HS256 "JWT Secret" — an earlier version of this method verified against that
    // legacy secret directly, which worked for this project only until Supabase auto-rotated it
    // to the new key type, after which every access token started failing local verification
    // silently and falling back to the slow remote check *on every single request* — exactly the
    // kind of regression a hardcoded secret can't recover from on its own. `jose`'s remote JWKS
    // set instead fetches Supabase's published public keys from this standard discovery endpoint
    // once and caches them, only re-fetching if a token references a key id it hasn't seen (an
    // actual rotation) — no per-request network call, and no code change needed next time
    // Supabase rotates this key, since it always re-syncs to whatever's currently published.
    this.jwks = createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
  }

  /** Verifies a bearer access token's signature and expiry locally against Supabase's published
   * JWKS first — see this class's own comment for why that's the right thing to verify against,
   * not a hardcoded secret. Falls back to the original remote `getUser` check whenever local
   * verification fails for *any* reason (a JWKS fetch failure, a signing method this doesn't
   * anticipate), so auth never breaks outright over it — it just runs at the old, slower cost
   * until whatever caused the local check to fail is resolved. */
  async verifyAccessToken(accessToken: string): Promise<AuthenticatedUser | null> {
    const local = await this.verifyAccessTokenLocally(accessToken);
    if (local) return local;
    return this.verifyAccessTokenRemotely(accessToken);
  }

  private async verifyAccessTokenLocally(accessToken: string): Promise<AuthenticatedUser | null> {
    try {
      const { payload } = await jwtVerify(accessToken, this.jwks, {
        audience: 'authenticated',
        algorithms: ['ES256'],
      });
      if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;
      return { id: payload.sub, email: payload.email };
    } catch (err) {
      // Logged at debug rather than swallowed entirely — the remote fallback below means this
      // never breaks auth, but a JWKS-side problem (vs. just an expired/garbage token, the
      // overwhelmingly common case) is worth being able to see if every request is suddenly slow
      // again the way the hardcoded-secret version was for four days with nothing in the logs.
      this.logger.debug(`Local token verification failed, falling back to remote: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  private async verifyAccessTokenRemotely(accessToken: string): Promise<AuthenticatedUser | null> {
    const { data, error } = await this.admin.auth.getUser(accessToken);
    if (error || !data.user?.email) return null;
    return { id: data.user.id, email: data.user.email };
  }
}
