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
   * secret — this used to call Supabase Auth's `getUser` API on every single request (and every
   * socket handshake), which meant every request in the app depended on a live round trip to
   * Supabase's own Auth service. Supabase's access tokens are HS256-signed with this secret
   * specifically so a backend can verify them without that call (this is Supabase's own
   * documented approach) — same guarantees (valid signature + not expired), no network hop. */
  verifyAccessToken(accessToken: string): AuthenticatedUser | null {
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
}
