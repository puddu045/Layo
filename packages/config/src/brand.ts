/**
 * Centralised brand configuration. "Layo" is a temporary working name —
 * change the values here (or override via EXPO_PUBLIC_BRAND_NAME / NEXT_PUBLIC_BRAND_NAME
 * / BRAND_NAME env vars where available) to rebrand without touching app code.
 */
export interface BrandConfig {
  name: string;
  tagline: string;
  legalName: string;
  supportEmail: string;
  primaryColor: string;
  accentColor: string;
}

function readBrandEnv(key: string): string | undefined {
  // Works in Node (API), Next.js (NEXT_PUBLIC_*) and Expo (EXPO_PUBLIC_*)
  // without requiring this package to depend on any one runtime's env typings.
  const env = (globalThis as any)?.process?.env ?? {};
  return env[`BRAND_${key}`] ?? env[`NEXT_PUBLIC_BRAND_${key}`] ?? env[`EXPO_PUBLIC_BRAND_${key}`];
}

export const BRAND: BrandConfig = {
  name: readBrandEnv('NAME') ?? 'Layo',
  tagline: readBrandEnv('TAGLINE') ?? 'Meet fellow travellers on your journey',
  legalName: readBrandEnv('LEGAL_NAME') ?? 'Layo Technologies Ltd',
  supportEmail: readBrandEnv('SUPPORT_EMAIL') ?? 'support@example.com',
  primaryColor: '#0B2545',
  accentColor: '#1FA2A6',
};
