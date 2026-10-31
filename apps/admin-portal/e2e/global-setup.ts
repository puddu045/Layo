import { config } from 'dotenv';

config({ path: '.env.local' });

export const E2E_BUSINESS_OWNER_EMAIL = 'e2e-business-owner@layo.test';
export const E2E_PASSWORD = 'Passw0rd!E2E';

/** The admin side of the suite reuses the real dedicated admin account rather than a throwaway
 * one — creating an admin requires a direct database write (flip `isAdmin`), which this script
 * deliberately doesn't do, so it stays a pure Supabase Auth setup step with no DB dependency. */
export const E2E_ADMIN_EMAIL = 'admin@layo.test';
export const E2E_ADMIN_PASSWORD = 'Passw0rd!Demo';

/** Idempotently ensures the business-owner test account exists in the local Supabase Auth
 * instance. Registering a *business* under it is left to the tests themselves (each run uses a
 * uniquely-named business so runs don't collide), but the account itself only needs to exist once. */
export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — copy .env.example to ' +
        '.env.local and fill them in (see its comments for what SUPABASE_SERVICE_ROLE_KEY is for).',
    );
  }

  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: E2E_BUSINESS_OWNER_EMAIL,
      password: E2E_PASSWORD,
      email_confirm: true,
    }),
  });

  if (!response.ok && response.status !== 422 /* already exists */) {
    throw new Error(`Could not create E2E test account: ${response.status} ${await response.text()}`);
  }
}
