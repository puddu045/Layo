# Layo

Social networking for air travellers — discover people on your flight, at your departure airport, or sharing your
layover. "Layo" is a temporary working name; see [docs/DECISIONS.md](docs/DECISIONS.md#brand-name) to rebrand.

**Phases 1 and 2** are built: repository foundation, authentication, profiles, flight lookup, multi-segment
journeys with layover calculation, traveller discovery, and connection requests with real-time private messaging.
See [docs/ROADMAP.md](docs/ROADMAP.md) for what's next (Phase 3: airport group chats) and
[docs/PRODUCT.md](docs/PRODUCT.md) / [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) /
[docs/DATA_MODEL.md](docs/DATA_MODEL.md) / [docs/DECISIONS.md](docs/DECISIONS.md) for everything else.

## Stack

Traveller app: React Native + Expo Router (iOS/Android/web) · Admin portal: Next.js + Tailwind · API: NestJS
(modular monolith) · DB: PostgreSQL + Prisma · Auth: Supabase Auth · Cache: Redis · Contracts: Zod + TypeScript ·
Repo: pnpm workspaces + Turborepo · Tests: Vitest.

## Prerequisites

- **Node.js 20+** and **pnpm** (`corepack enable` then `corepack prepare pnpm@9.15.0 --activate`, or
  `npm install -g pnpm`).
- **Docker Desktop** — for local Redis (and for the local Supabase stack, which runs its own Postgres via
  Docker under the hood).
- **Supabase CLI** — `npm install -g supabase` — for local Auth + Postgres.
- For mobile testing: **Expo Go** on your phone (fastest), or Android Studio / Xcode if you want a simulator.
  None of these are required to run the web build.

Everything below has been written and typechecked in this environment, but actually **running** the local
Supabase stack, Docker, and a mobile emulator requires tools (Docker daemon, Android/iOS SDKs) that this sandboxed
build environment does not have — see "Known limitations" in the completion report. The steps below are exactly
what you need to run on a normal development machine (tested conventions, not guesses).

## 1. Install dependencies

```bash
pnpm install
```

## 2. Configure environment variables

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/traveller/.env.example apps/traveller/.env
cp apps/admin-portal/.env.example apps/admin-portal/.env.local
```

## 3. Start local infrastructure

```bash
# Postgres + Auth + Storage (Supabase CLI)
supabase start
# copy the printed API URL / anon key / service_role key / DB URL into the .env files above

# Redis
docker compose up -d
```

## 4. Set up the database

```bash
pnpm db:generate   # generate the Prisma client
pnpm db:migrate    # create tables from packages/db/prisma/schema.prisma
pnpm db:seed       # airports, airlines, and 6 demo travellers with overlapping journeys
```

The seed script also tries to create matching Supabase Auth users for the demo accounts (see
[docs/DATA_MODEL.md](docs/DATA_MODEL.md#supabase-auth-vs-postgres-users)); if that succeeds, you can sign in as
e.g. `demo-amara@layo.test` / the password in `SEED_DEMO_PASSWORD` (default `Passw0rd!Demo`).

## 5. Run the API

```bash
pnpm dev:api
```

Health check: `curl http://localhost:3333/api/v1/health`.

## 6. Run the traveller app

```bash
pnpm dev:traveller      # opens the Expo dev tools — press w for web, or scan the QR code with Expo Go
# or directly:
pnpm --filter @layo/traveller dev:web
```

## 7. Run the admin portal

```bash
pnpm dev:admin
```

Open http://localhost:3000 — you'll be redirected to `/login`. Sign in with an account that has `User.isAdmin =
true` in Postgres (none of the seeded demo accounts are admins by default; flip one with
`UPDATE "User" SET "isAdmin" = true WHERE email = 'demo-amara@layo.test';` via `pnpm db:studio` or `psql`).

## Running checks

```bash
pnpm typecheck   # every package/app
pnpm lint        # every package/app
pnpm test        # Vitest: packages/contracts, packages/db, apps/api
```

## Windows notes

- Everything above runs natively on Windows via pnpm/Node — no WSL required.
- Docker Desktop must be running before `supabase start` or `docker compose up -d`.
- If `supabase` or `pnpm` aren't recognized after a global install, open a new terminal (PATH changes need a
  fresh shell).
- Android emulator requires Android Studio; iOS simulator requires a Mac and isn't available on Windows — use
  Expo Go on a physical device, or the web build, instead.
- **Testing on a physical phone via Expo Go**: `EXPO_PUBLIC_*` URLs in `apps/traveller/.env` must point at your
  PC's LAN IP, not `localhost` (find it with `Get-NetIPAddress -AddressFamily IPv4` in PowerShell). If Docker
  Desktop (WSL2) is installed, Windows also has a virtual "vEthernet (WSL...)" adapter, and Expo's LAN-IP
  auto-detection can pick that one instead of your real WiFi adapter — the phone then can't reach Metro at all
  and Expo Go shows a generic "Something went wrong" screen. Force the right one with:
  `$env:REACT_NATIVE_PACKAGER_HOSTNAME="<your WiFi IP>"; pnpm dev:traveller`. The phone and PC must also be on
  the same WiFi network, and some routers block device-to-device traffic ("AP/client isolation") even then.

## Monorepo scripts reference

| Command | What it does |
|---|---|
| `pnpm dev` | Runs every app's dev server in parallel (Turborepo) |
| `pnpm build` | Builds every app/package |
| `pnpm db:studio` | Opens Prisma Studio against your local database |
| `pnpm --filter @layo/api test` | Run just the API's tests |

## Known limitations (Phase 1)

See the completion report delivered alongside this build for the full list — in short: no Supabase/Docker/mobile
emulator in this build environment so `pnpm install`/`typecheck`/`test` were verified here but
`supabase start` / live app usage were not; Aviationstack adapter is implemented per its documented API shape but
untested live (no API key); profile photo upload, Google/Apple login, and in-app date pickers are deferred; see
[docs/ROADMAP.md](docs/ROADMAP.md) for Phases 2–5.
