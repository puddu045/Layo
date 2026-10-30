import { z } from 'zod';
import { DEFAULT_MATCHING_CONFIG } from './matching';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:19006,http://localhost:3000,http://localhost:8081')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  FLIGHT_PROVIDER: z.enum(['mock', 'aviationstack']).default('mock'),
  AVIATIONSTACK_API_KEY: z.string().optional(),
  AVIATIONSTACK_BASE_URL: z.string().url().default('https://api.aviationstack.com/v1'),
  FLIGHT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  DISCOVERY_DEPARTURE_WINDOW_MINUTES_BEFORE: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_MATCHING_CONFIG.departureAirportWindowMinutesBefore),
  DISCOVERY_DEPARTURE_WINDOW_MINUTES_AFTER: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(DEFAULT_MATCHING_CONFIG.departureAirportWindowMinutesAfter),
  DISCOVERY_MIN_AIRPORT_OVERLAP_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_MATCHING_CONFIG.minAirportOverlapMinutes),
  AIRPORT_ROOM_ACCESS_WINDOW_HOURS_BEFORE: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_MATCHING_CONFIG.airportRoomAccessWindowHoursBefore),
  AIRPORT_ROOM_ACCESS_WINDOW_HOURS_AFTER: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_MATCHING_CONFIG.airportRoomAccessWindowHoursAfter),
  AIRPORT_ROOM_MESSAGE_RETENTION_DAYS: z.coerce.number().int().positive().default(90),

  MIN_SIGNUP_AGE_YEARS: z.coerce.number().int().positive().default(18),
});

export type ApiEnv = z.infer<typeof envSchema>;

let cachedEnv: ApiEnv | undefined;

/** Parses and validates `process.env` for the API. Throws with a readable message on failure. */
export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  if (cachedEnv) return cachedEnv;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

/** For tests only: clears the cached parsed env so a fresh load picks up new values. */
export function resetCachedEnv(): void {
  cachedEnv = undefined;
}
