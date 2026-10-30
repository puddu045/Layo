# Decisions

Non-obvious engineering/product calls made while building Phase 1, and why. Format: decision, then the
reasoning, so a future change can weigh the same trade-off deliberately rather than by accident.

## Brand name

"Layo" is a placeholder. All of it lives behind `@layo/config`'s `BRAND` object
(`packages/config/src/brand.ts`), reading `BRAND_NAME` / `NEXT_PUBLIC_BRAND_NAME` / `EXPO_PUBLIC_BRAND_NAME` env
vars with "Layo" as the fallback. The npm package scope (`@layo/*`) and bundle identifiers
(`com.layo.traveller`) are not runtime-configurable — renaming those is a one-time find/replace when the real
name is chosen, documented here rather than over-engineered into env vars that would need their own tooling.

## Supabase token verification strategy

The API verifies bearer tokens by calling `supabase.auth.getUser(token)` (a network round-trip to Supabase)
rather than verifying the JWT locally against `SUPABASE_JWT_SECRET`. This is slightly slower per-request but:

- Works correctly regardless of whether a given Supabase project signs tokens symmetrically (HS256) or
  asymmetrically (newer Supabase projects default to asymmetric signing keys), without the API needing to know
  which.
- Automatically respects server-side session revocation (sign-out, password change) — local JWT verification
  would accept a stolen-but-not-yet-expired token until it expires.

`SUPABASE_JWT_SECRET` is still accepted as an env var for a future optimisation (local verification with a
Redis-cached revocation check), but isn't used yet.

## Schedule vs. passenger verification

A flight number + date proves a *schedule exists*; it never proves someone holds a ticket. The data model keeps
these conceptually separate: `Flight.dataSource` / a lookup response's `verified` flag describe **schedule**
confidence only (did a real provider confirm this flight exists), never passenger identity. There is no passenger
verification step in Phase 1 scope, and the UI never implies one — manual entries and mock-provider results are
always clearly labelled as unverified schedules, not "unverified passengers."

## Meeting accessibility is always unconfirmed

`Match.meetingAccessibilityUnconfirmed` is hardcoded `true` for every match, regardless of whether both
travellers' terminal data happens to be known and identical. Two travellers in the same named terminal are not
necessarily able to meet airside (security re-screening, differing gate zones, immigration status), so "same
terminal" is not strong enough evidence to claim confirmed. Rather than build partial, potentially-wrong
confidence logic now, the honest simplification is to always say "unconfirmed" until a real per-airport
connectivity dataset exists.

## Match category reflects the requester's own presence type

See [DATA_MODEL.md](./DATA_MODEL.md#matching-design). The alternative — categorising a match by some combination
of both users' presence types — adds real complexity (what's the category when one person is on a layover and
the other is just departing?) for no clear product benefit. Categorising from "my own situation" answers the
question a user actually has ("why am I seeing this person?") directly.

## Journeys module re-fetches flight data server-side before persisting

When a client confirms a flight candidate from a lookup, the request contains `{flightNumber, departureDate,
providerRef}` — not the full candidate payload. `JourneysService` re-runs the provider lookup server-side and
only persists a flight if a candidate with that exact `providerRef` still comes back. This means the schedule
data that ends up in Postgres always originates from the server's own trusted provider call, never from
client-supplied fields, without needing bespoke validation of every field a client could otherwise tamper with.

## Vitest over Jest, everywhere

The brief allows either. Vitest was chosen for every package (including the NestJS API) for one consistent test
runner/config shape across the whole monorepo, faster startup, and native ESM/TS support without `ts-jest`
configuration. NestJS itself doesn't require Jest — its DI container is just TypeScript classes, which Vitest
exercises identically.

## Zod-based validation instead of class-validator

NestJS conventionally pairs with `class-validator`/`class-transformer` decorators. This project uses a custom
`ZodValidationPipe` (`apps/api/src/common/pipes/zod-validation.pipe.ts`) against the same `@layo/contracts` Zod
schemas the frontends import, per the brief's "shared data contracts: Zod and TypeScript" requirement — one
schema defines validation, the TypeScript type, and (indirectly) the API documentation, instead of maintaining
parallel decorator-based DTOs and Zod schemas.

## No microservices

See [ARCHITECTURE.md](./ARCHITECTURE.md#backend-modular-monolith-not-microservices). Module boundaries are
enforced by convention (only talk to another module through its exported service) rather than process
boundaries, which is cheap to split later and avoids distributed-systems complexity (service discovery, network
failure handling, distributed transactions) the product doesn't need yet.
