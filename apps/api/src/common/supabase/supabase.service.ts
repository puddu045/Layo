import { Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

  constructor() {
    const env = loadApiEnv();
    this.admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /** Verifies a bearer access token against Supabase and returns the identity it belongs to. */
  async verifyAccessToken(accessToken: string): Promise<AuthenticatedUser | null> {
    const { data, error } = await this.admin.auth.getUser(accessToken);
    if (error || !data.user?.email) return null;
    return { id: data.user.id, email: data.user.email };
  }
}
