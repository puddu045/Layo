import { PrismaClient } from '../generated/client';

export * from '../generated/client';
export * from './fixtures';
export * from './flight-time';

declare global {
  // eslint-disable-next-line no-var
  var __layoPrisma: PrismaClient | undefined;
}

/**
 * Singleton PrismaClient. Reused across hot-reloads in development to avoid
 * exhausting the Postgres connection pool.
 */
export const prisma: PrismaClient =
  globalThis.__layoPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__layoPrisma = prisma;
}
