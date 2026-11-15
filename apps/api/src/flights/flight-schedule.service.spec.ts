import { beforeEach, describe, expect, it } from 'vitest';
import { resetCachedEnv } from '@layo/config';
import type { FlightCandidate } from '@layo/contracts';
import { FlightScheduleService } from './flight-schedule.service';
import { FlightProviderUnavailableError } from '../flight-provider/aviationstack-flight.provider';
import type { IFlightProvider } from '../flight-provider/flight-provider.interface';
import type { PrismaService } from '../common/prisma/prisma.service';

function candidate(overrides: Partial<FlightCandidate> = {}): FlightCandidate {
  return {
    providerRef: 'aerodatabox:BA123:2026-06-01',
    airline: { iataCode: 'BA', name: 'British Airways' },
    flightNumber: 'BA123',
    departureAirport: { iataCode: 'LHR', name: 'Heathrow', city: 'London', country: 'UK', timezone: 'Europe/London' },
    arrivalAirport: { iataCode: 'DXB', name: 'Dubai Intl', city: 'Dubai', country: 'UAE', timezone: 'Asia/Dubai' },
    scheduledDepartureUtc: '2026-06-01T21:00:00.000Z',
    scheduledArrivalUtc: '2026-06-02T04:30:00.000Z',
    status: 'SCHEDULED',
    dataSource: 'AERODATABOX',
    isCodeshare: false,
    ...overrides,
  };
}

/** In-memory stand-in for the one Prisma model this service touches, keyed the same way the
 * real `@@unique([departureAirportIata, date])` is. */
function fakePrisma(): PrismaService {
  const rows = new Map<string, { payload: unknown; expiresAt: Date }>();
  return {
    client: {
      flightScheduleCache: {
        findUnique: async ({ where }: { where: { departureAirportIata_date: { departureAirportIata: string; date: string } } }) => {
          const key = `${where.departureAirportIata_date.departureAirportIata}:${where.departureAirportIata_date.date}`;
          const row = rows.get(key);
          return row ? { ...row } : null;
        },
        upsert: async ({
          where,
          create,
        }: {
          where: { departureAirportIata_date: { departureAirportIata: string; date: string } };
          create: { payload: unknown; expiresAt: Date };
        }) => {
          const key = `${where.departureAirportIata_date.departureAirportIata}:${where.departureAirportIata_date.date}`;
          rows.set(key, { payload: create.payload, expiresAt: create.expiresAt });
          return create;
        },
      },
    },
  } as unknown as PrismaService;
}

/** Matches how the real providers split the two steps: `fetchDepartureSchedule` returns the
 * opaque "schedule" (here, simply a `FlightCandidate[]`, same as the mock provider's own
 * approach), and `resolveDeparturesForDestination` filters it — the database-touching part in
 * the real providers, but these tests don't need a database, just the filtering behaviour. */
function fakeProvider(impl: Partial<IFlightProvider> & { schedule?: () => Promise<FlightCandidate[]> }): IFlightProvider {
  const { schedule, ...rest } = impl;
  return {
    lookup: async () => [],
    ...(schedule && {
      fetchDepartureSchedule: schedule,
      resolveDeparturesForDestination: async (s: unknown, destinationAirportIata: string) =>
        (s as FlightCandidate[]).filter((c) => c.arrivalAirport.iataCode === destinationAirportIata),
    }),
    ...rest,
  };
}

describe('FlightScheduleService', () => {
  beforeEach(() => {
    // `loadApiEnv` validates the full env schema even though `writeCache` only reads the cache
    // TTL from it — these are just enough fake values to satisfy the other required vars.
    process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
    process.env.SUPABASE_URL ??= 'http://localhost:54321';
    process.env.SUPABASE_ANON_KEY ??= 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
    process.env.SUPABASE_JWT_SECRET ??= 'test-jwt-secret';
    resetCachedEnv();
  });

  it('filters cached departures down to the requested destination', async () => {
    let calls = 0;
    const provider = fakeProvider({
      schedule: async () => {
        calls++;
        return [
          candidate({ flightNumber: 'BA123', arrivalAirport: { iataCode: 'DXB', name: 'Dubai', city: 'Dubai', country: 'UAE', timezone: 'Asia/Dubai' } }),
          candidate({ flightNumber: 'BA789', arrivalAirport: { iataCode: 'SIN', name: 'Changi', city: 'Singapore', country: 'SG', timezone: 'Asia/Singapore' } }),
        ];
      },
    });
    const service = new FlightScheduleService(provider, fakePrisma());

    const toDubai = await service.search({ departureAirportIata: 'LHR', destinationAirportIata: 'DXB', date: '2026-06-01' });
    expect(toDubai.candidates).toHaveLength(1);
    expect(toDubai.candidates[0]!.flightNumber).toBe('BA123');
    expect(toDubai.verified).toBe(true);

    // A different destination, same airport+date: reuses the cached schedule instead of calling
    // the provider's (expensive) fetch again.
    const toSingapore = await service.search({ departureAirportIata: 'LHR', destinationAirportIata: 'SIN', date: '2026-06-01' });
    expect(toSingapore.candidates).toHaveLength(1);
    expect(toSingapore.candidates[0]!.flightNumber).toBe('BA789');
    expect(calls).toBe(1);
  });

  it('de-duplicates concurrent searches for the same airport and date', async () => {
    let calls = 0;
    const provider = fakeProvider({
      schedule: async () => {
        calls++;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return [candidate()];
      },
    });
    const service = new FlightScheduleService(provider, fakePrisma());

    const [a, b] = await Promise.all([
      service.search({ departureAirportIata: 'LHR', destinationAirportIata: 'DXB', date: '2026-06-01' }),
      service.search({ departureAirportIata: 'LHR', destinationAirportIata: 'DXB', date: '2026-06-01' }),
    ]);
    expect(calls).toBe(1);
    expect(a.candidates).toHaveLength(1);
    expect(b.candidates).toHaveLength(1);
  });

  it('returns an empty, unverified result with a notice when the provider is unavailable', async () => {
    const provider = fakeProvider({
      schedule: async () => {
        throw new FlightProviderUnavailableError('AeroDataBox monthly unit budget exceeded');
      },
    });
    const service = new FlightScheduleService(provider, fakePrisma());

    const result = await service.search({ departureAirportIata: 'LHR', destinationAirportIata: 'DXB', date: '2026-06-01' });
    expect(result.candidates).toHaveLength(0);
    expect(result.verified).toBe(false);
    expect(result.notice).toContain('temporarily unavailable');
  });

  it('re-fetches once a cached entry has passed its expiry instead of serving stale data', async () => {
    let calls = 0;
    const provider = fakeProvider({
      schedule: async () => {
        calls++;
        return [candidate()];
      },
    });
    const prisma = fakePrisma();
    // Plant an already-expired row directly, bypassing the service's own writeCache (which
    // always sets a future expiry) — simulates a cache entry that's aged past its 7-day limit.
    await prisma.client.flightScheduleCache.upsert({
      where: { departureAirportIata_date: { departureAirportIata: 'LHR', date: '2026-06-01' } },
      create: { payload: [candidate({ flightNumber: 'STALE1' })], expiresAt: new Date(Date.now() - 1000) },
    } as never);
    const service = new FlightScheduleService(provider, prisma);

    const result = await service.search({ departureAirportIata: 'LHR', destinationAirportIata: 'DXB', date: '2026-06-01' });
    expect(calls).toBe(1);
    expect(result.candidates[0]!.flightNumber).toBe('BA123');
  });

  it('falls back to a manual-entry notice when the configured provider has no schedule search', async () => {
    const provider = fakeProvider({}); // no fetchDepartureSchedule implemented (e.g. aviationstack)
    const service = new FlightScheduleService(provider, fakePrisma());

    const result = await service.search({ departureAirportIata: 'LHR', destinationAirportIata: 'DXB', date: '2026-06-01' });
    expect(result.candidates).toHaveLength(0);
    expect(result.notice).toContain('manually');
  });
});
