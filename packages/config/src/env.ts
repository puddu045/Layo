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

  FLIGHT_PROVIDER: z.enum(['mock', 'aviationstack', 'aerodatabox']).default('mock'),
  AVIATIONSTACK_API_KEY: z.string().optional(),
  AVIATIONSTACK_BASE_URL: z.string().url().default('https://api.aviationstack.com/v1'),
  FLIGHT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  // AeroDataBox via RapidAPI — used for the airport-to-airport schedule search (not flight
  // pricing/booking). The Basic/free RapidAPI plan caps usage at 400 "units"/month and 12 hours
  // per schedule request, which is why this needs its own budget + cache rather than reusing the
  // generic flight-lookup cache above as-is.
  AERODATABOX_API_KEY: z.string().optional(),
  AERODATABOX_API_HOST: z.string().default('aerodatabox.p.rapidapi.com'),
  AERODATABOX_BASE_URL: z.string().url().default('https://aerodatabox.p.rapidapi.com'),
  // Matches the RapidAPI Basic/free plan's monthly allowance by default — lower this if you're on
  // an even more restricted plan, or raise it only if you've actually upgraded (this budget is
  // enforced server-side and never bypassed automatically).
  AERODATABOX_MONTHLY_UNIT_BUDGET: z.coerce.number().int().positive().default(400),
  // RapidAPI doesn't expose a stable per-call unit cost in the free tier's response — this is a
  // conservative, configurable estimate (1 request = 1 unit) used to track consumption locally.
  // Adjust it if your own usage dashboard shows a different real cost per call.
  AERODATABOX_UNITS_PER_CALL: z.coerce.number().int().positive().default(1),
  // How long a cached per-airport/date departures search may be reused — AeroDataBox's free plan
  // permits caching results for up to 7 days.
  FLIGHT_SCHEDULE_CACHE_TTL_DAYS: z.coerce.number().int().positive().max(7).default(7),

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
