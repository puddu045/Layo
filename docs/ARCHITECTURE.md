# Architecture

## Monorepo layout

```
apps/
  traveller/      Expo Router app (iOS, Android, web)
  admin-portal/   Next.js App Router admin/business portal
  api/            NestJS modular monolith

packages/
  db/             Prisma schema, migrations, seed script, fixtures
  contracts/      Zod schemas + inferred TS types shared by every app
  config/         Brand config, matching/discovery defaults, env loader

docs/             This documentation
supabase/         Local Supabase CLI config (Auth + local Postgres)
```

Managed with **pnpm workspaces** + **Turborepo**. Every app depends on `@layo/contracts` and `@layo/config`;
only the API and the seed script depend on `@layo/db` (the generated Prisma client never ships to a client app).

## Backend: modular monolith, not microservices

NestJS, organised as one deployable service with clearly separated modules (`apps/api/src/<module>`), each with
its own controller/service/module. This gets the maintainability benefits of clear domain boundaries without the
operational cost of microservices at this stage; any module (e.g. Matching, or Messaging once built) can be
extracted into its own service later without changing its public contract, because:

- Every module talks to Postgres through a single shared `PrismaService`, never through another module's internals.
- Cross-module reuse happens through exported services (e.g. `JourneysModule` imports `FlightsModule`), not
  reaching into another module's repository layer directly.
- Request/response shapes are Zod schemas in `@layo/contracts`, so a future service split keeps the same wire
  contract.

Phase 1 modules: `Auth`, `Users`, `Airports`, `FlightProvider` + `Flights`, `Journeys`, `Matching`.
Schema-only foundations for later phases: `Connection`, `Message`, `AirportRoom`(+ membership/messages),
`Business`, `Deal`, `Report`, `Block`, `Notification`, `AuditLog` — all modelled in Prisma now, with no NestJS
module built on top of them yet (see [ROADMAP.md](./ROADMAP.md)).

## Authentication

Supabase Auth issues access tokens; the API verifies them server-side on every request via
`supabase.auth.getUser(token)` (not local JWT-secret verification) — see
[DECISIONS.md](./DECISIONS.md#supabase-token-verification-strategy) for why. A global `SupabaseAuthGuard`
(`apps/api/src/common/guards/supabase-auth.guard.ts`) runs on every route except those marked `@Public()`, and it
upserts a local `User` row keyed by the Supabase user id so the rest of the API can treat `req.user.id` as a
trustworthy foreign key — client-supplied user ids are never trusted anywhere.

## Flight data

`IFlightProvider` (`apps/api/src/flight-provider/flight-provider.interface.ts`) is the single seam between the
API and any flight-data vendor:

- `MockFlightProvider` — deterministic, offline, backed by fixtures in `packages/db/src/fixtures.ts`. Default
  provider (`FLIGHT_PROVIDER=mock`), requires no API key.
- `AviationstackFlightProvider` — calls the real Aviationstack `/flights` endpoint, auto-upserts any new
  Airport/Airline reference rows it encounters, and throws a typed `FlightProviderUnavailableError` on any
  network/API failure so the caller can degrade gracefully instead of 500ing.

`FlightsService` wraps whichever provider is configured with a Redis cache (`FLIGHT_CACHE_TTL_SECONDS`) and
catches provider failures, returning an empty, clearly-labelled "try manual entry" response rather than an error.

## Matching / discovery

The matching engine is split into a **pure, dependency-free core** and a **Prisma-backed orchestration layer**,
specifically so the matching rules are unit-testable without a database:

- `apps/api/src/matching/presence.util.ts` — turns an ordered list of journey segments into "presence windows"
  (DEPARTURE or LAYOVER) at each airport they touch.
- `apps/api/src/matching/matching.algorithm.ts` — pure function `computeMatches(...)` that takes the requester's
  windows/flight ids and a pre-filtered candidate list, and returns categorised, deduplicated `Match[]`.
- `apps/api/src/matching/matching.service.ts` — the only piece that talks to Prisma: fetches the requester's
  discoverable journeys, finds candidate journeys touching the same airports/flights, excludes blocked users and
  non-discoverable profiles/journeys, resolves connection status, and calls the pure core.

See [DATA_MODEL.md](./DATA_MODEL.md#matching-design) for the exact category rules.

## Frontend

- **Traveller app**: Expo Router (file-based routing) + TypeScript, `@tanstack/react-query` for server state
  (gives consistent loading/error/empty handling for free), a small hand-rolled design-token system
  (`src/theme/tokens.ts`) rather than a UI kit, so the "premium, restrained" visual direction stays easy to tune.
  Supabase JS client with AsyncStorage-backed session persistence; a thin `api-client.ts` attaches the current
  Supabase access token to every API call.
- **Admin portal**: Next.js App Router, Tailwind CSS, a client-side `AuthGate` for the `(dashboard)` route group.
  Deliberately thin in Phase 1 — see [PRODUCT.md](./PRODUCT.md) for scope.

## Monorepo/Metro note

Expo's Metro bundler needs explicit configuration to resolve pnpm-workspace packages
(`apps/traveller/metro.config.js` sets `watchFolders`, `nodeModulesPaths`, and enables symlink resolution) — this
is the standard pattern from Expo's own monorepo guide, not a Layo-specific workaround.
