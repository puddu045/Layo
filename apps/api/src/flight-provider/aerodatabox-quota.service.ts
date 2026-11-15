import { Injectable } from '@nestjs/common';
import { loadApiEnv } from '@layo/config';
import { PrismaService } from '../common/prisma/prisma.service';

/** Thrown when consuming more units would exceed the configured monthly budget — the call is
 * never made. Distinct from `FlightProviderUnavailableError` so callers can show a clearer
 * "try again next month / add manually" message instead of a generic provider failure. */
export class AeroDataBoxQuotaExceededError extends Error {}

const PROVIDER_KEY = 'AERODATABOX';

/**
 * Durable (Postgres-backed, not Redis) monthly unit counter for AeroDataBox's RapidAPI plan.
 * `RedisService` is explicitly best-effort and never durable (see its own comment), which is
 * fine for a cache but not for quota enforcement — under-counting there could mean silently
 * exceeding the free plan's limit, which this app must never do on its own.
 */
@Injectable()
export class AeroDataBoxQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Checks the current month's usage against the configured budget and, if there's room,
   * atomically reserves `units` before the caller makes its HTTP request — reserved up front
   * (not after a successful response) so a burst of concurrent requests can't all pass the
   * check before any of them has recorded its usage. Throws instead of ever silently going over. */
  async reserve(units: number): Promise<void> {
    const env = loadApiEnv();
    const periodKey = currentPeriodKey();
    const budget = env.AERODATABOX_MONTHLY_UNIT_BUDGET;

    // Increments first (atomic at the row level — concurrent reservations serialize against each
    // other through Postgres's own row lock on this UPDATE) and checks the result, rather than
    // checking-then-incrementing as two separate statements, which would let two concurrent
    // requests both read the same "under budget" value and both pass before either recorded its
    // usage.
    const counter = await this.prisma.client.apiUsageCounter.upsert({
      where: { provider_periodKey: { provider: PROVIDER_KEY, periodKey } },
      create: { provider: PROVIDER_KEY, periodKey, unitsUsed: units },
      update: { unitsUsed: { increment: units } },
    });

    if (counter.unitsUsed > budget) {
      // Give back the reservation this call just made — it never happened as far as the budget
      // is concerned, since the request it was reserved for is about to be refused.
      await this.prisma.client.apiUsageCounter.update({
        where: { provider_periodKey: { provider: PROVIDER_KEY, periodKey } },
        data: { unitsUsed: { decrement: units } },
      });
      throw new AeroDataBoxQuotaExceededError(
        `AeroDataBox monthly unit budget (${budget}) would be exceeded ` +
          `(${counter.unitsUsed - units} used, ${units} requested) — try again next month or add this flight manually.`,
      );
    }
  }

  async usedThisMonth(): Promise<number> {
    const counter = await this.prisma.client.apiUsageCounter.findUnique({
      where: { provider_periodKey: { provider: PROVIDER_KEY, periodKey: currentPeriodKey() } },
    });
    return counter?.unitsUsed ?? 0;
  }
}

function currentPeriodKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
