import { beforeEach, describe, expect, it } from 'vitest';
import { resetCachedEnv } from '@layo/config';
import { AeroDataBoxQuotaExceededError, AeroDataBoxQuotaService } from './aerodatabox-quota.service';
import type { PrismaService } from '../common/prisma/prisma.service';

/** In-memory stand-in for the one Prisma model this service touches. */
function fakePrisma() {
  const rows = new Map<string, { provider: string; periodKey: string; unitsUsed: number }>();
  const key = (provider: string, periodKey: string) => `${provider}:${periodKey}`;

  return {
    client: {
      apiUsageCounter: {
        upsert: async ({
          where,
          create,
          update,
        }: {
          where: { provider_periodKey: { provider: string; periodKey: string } };
          create: { provider: string; periodKey: string; unitsUsed: number };
          update: { unitsUsed?: { increment: number } };
        }) => {
          const k = key(where.provider_periodKey.provider, where.provider_periodKey.periodKey);
          const existing = rows.get(k);
          if (!existing) {
            rows.set(k, { ...create });
            return { ...create };
          }
          if (update.unitsUsed?.increment) existing.unitsUsed += update.unitsUsed.increment;
          return { ...existing };
        },
        update: async ({
          where,
          data,
        }: {
          where: { provider_periodKey: { provider: string; periodKey: string } };
          data: { unitsUsed: { increment?: number; decrement?: number } };
        }) => {
          const k = key(where.provider_periodKey.provider, where.provider_periodKey.periodKey);
          const existing = rows.get(k)!;
          if (data.unitsUsed.increment) existing.unitsUsed += data.unitsUsed.increment;
          if (data.unitsUsed.decrement) existing.unitsUsed -= data.unitsUsed.decrement;
          return { ...existing };
        },
        findUnique: async ({ where }: { where: { provider_periodKey: { provider: string; periodKey: string } } }) => {
          const k = key(where.provider_periodKey.provider, where.provider_periodKey.periodKey);
          return rows.get(k) ? { ...rows.get(k)! } : null;
        },
      },
    },
  } as unknown as PrismaService;
}

describe('AeroDataBoxQuotaService', () => {
  beforeEach(() => {
    // `loadApiEnv` validates the full env schema even though this service only reads one field
    // from it — these are just enough fake values to satisfy the other required vars.
    process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
    process.env.SUPABASE_URL ??= 'http://localhost:54321';
    process.env.SUPABASE_ANON_KEY ??= 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
    process.env.SUPABASE_JWT_SECRET ??= 'test-jwt-secret';
    delete process.env.AERODATABOX_MONTHLY_UNIT_BUDGET;
    resetCachedEnv();
  });

  it('allows reservations under the configured budget', async () => {
    process.env.AERODATABOX_MONTHLY_UNIT_BUDGET = '10';
    resetCachedEnv();
    const service = new AeroDataBoxQuotaService(fakePrisma());

    await service.reserve(4);
    await service.reserve(4);
    expect(await service.usedThisMonth()).toBe(8);
  });

  it('refuses a reservation that would exceed the budget, and does not count it', async () => {
    process.env.AERODATABOX_MONTHLY_UNIT_BUDGET = '10';
    resetCachedEnv();
    const service = new AeroDataBoxQuotaService(fakePrisma());

    await service.reserve(8);
    await expect(service.reserve(4)).rejects.toThrow(AeroDataBoxQuotaExceededError);
    // The refused reservation is rolled back, not left half-counted.
    expect(await service.usedThisMonth()).toBe(8);
  });

  it('allows a reservation that exactly meets the remaining budget', async () => {
    process.env.AERODATABOX_MONTHLY_UNIT_BUDGET = '10';
    resetCachedEnv();
    const service = new AeroDataBoxQuotaService(fakePrisma());

    await service.reserve(6);
    await service.reserve(4);
    expect(await service.usedThisMonth()).toBe(10);
  });
});
