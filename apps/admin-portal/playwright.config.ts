import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.local' });

/**
 * Needs the full local stack already running: Supabase/Postgres/Redis (docker compose + supabase
 * start) and the NestJS API (`pnpm --filter @layo/api dev`). This config only brings up the
 * admin-portal's own Next.js dev server — Playwright can't start the backend for you.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false, // the suite shares a handful of real accounts — avoid cross-test races
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
