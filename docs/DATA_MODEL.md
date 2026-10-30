# Data model

Full source of truth: [`packages/db/prisma/schema.prisma`](../packages/db/prisma/schema.prisma).

## Identity vs. profile

`User` mirrors a Supabase Auth user (id, email, status, isAdmin) and holds **no public-facing content**. `Profile`
is a separate 1:1 table with everything another traveller might see (display name, bio, interests, languages,
computed-age source `dateOfBirth`, discoverability flag). This split means:

- A public API response can serialize a `Profile` without an engineer having to remember to strip `email`.
- Account-level operations (suspension, deletion) don't need to touch profile content at all.

## Reference data

`Airport` (IATA code as primary key, IANA timezone, lat/long) and `Airline` (IATA code as primary key) are shared
reference tables, seeded from `packages/db/src/fixtures.ts`. The Aviationstack provider auto-upserts rows it
encounters that aren't seeded yet (see [ARCHITECTURE.md](./ARCHITECTURE.md)).

## Flights are canonical, not per-user

`Flight` represents one scheduled flight **instance** (airline + flight number + route + scheduled departure
date), not a per-user booking. Multiple users' `JourneySegment` rows point at the same `Flight` row when they're
genuinely on the same flight — that's what makes "same flight" matching a simple foreign-key join rather than a
fuzzy comparison.

De-duplication key: `Flight.canonicalKey`, computed by
[`computeCanonicalFlightKey`](../packages/db/src/flight-time.ts) as:

```
{operatingAirline ?? airline}-{operatingFlightNumber ?? flightNumber}-{departureAirport}-{arrivalAirport}-{UTC departure date}
```

Using the **operating** flight/airline when present (not the marketing one) is what makes a codeshare-booked
traveller (e.g. ticketed as `AA7890`, actually operated as `BA123`) resolve to the exact same `Flight` row as
someone booked directly on `BA123` — see the codeshare test in
[`flight-time.spec.ts`](../packages/db/src/flight-time.spec.ts).

## Journeys, segments and layovers

A `Journey` belongs to one user and has an ordered list of `JourneySegment` rows (`sequence` 1..N), each pointing
at a `Flight`. Layovers are **not stored** — they're derived on every read
([`layover.util.ts`](../apps/api/src/journeys/layover.util.ts)) from consecutive segments: a layover exists
between segment N and N+1 only when segment N's arrival airport equals segment N+1's departure airport (a real
connection), so an unrelated later trip in the same journey never gets miscounted as a layover.

## Matching design

Full algorithm: [`matching.algorithm.ts`](../apps/api/src/matching/matching.algorithm.ts) and
[`presence.util.ts`](../apps/api/src/matching/presence.util.ts). Key decisions (see
[DECISIONS.md](./DECISIONS.md) for the reasoning):

- **Presence windows**, not raw flight times. Every segment contributes either a `DEPARTURE` window
  (`[sched_departure - 3h, sched_departure + 30m]` by default, both configurable) or a `LAYOVER` window
  (`[previous arrival, this departure]`), depending on whether it's a genuine connection.
- **Category is from the requester's point of view.** If *your* presence at an airport is a layover, anyone whose
  window overlaps it is reported under `SAME_LAYOVER_AIRPORT` for you — even if *they're* just departing from
  that airport on a direct flight. This keeps "what kind of match is this, for me" simple and consistent.
- **Same-flight suppresses the redundant airport match.** If two people share a canonical flight, that's reported
  once as `SAME_FLIGHT`; they're excluded from the departure/layover pass entirely (otherwise every same-flight
  pair would also show up as a same-departure-airport match).
- **30-minute minimum overlap** (configurable: `DISCOVERY_MIN_AIRPORT_OVERLAP_MINUTES`) applies to both airport
  categories, not to `SAME_FLIGHT` (being on the same aircraft needs no overlap check).
- **`meetingAccessibilityUnconfirmed` is always `true`.** There is no terminal-connectivity dataset in Phase 1 —
  see [DECISIONS.md](./DECISIONS.md#meeting-accessibility-is-always-unconfirmed).
- Expired overlaps (`overlapEndUtc < now`), blocked users (either direction), and non-discoverable
  profiles/journeys are excluded before the pure matching core ever sees a candidate.

## Foundations for later phases (modelled, not yet wired to an API)

`Connection`, `Message`, `AirportRoom` / `AirportRoomMembership` / `AirportRoomMessage`, `Business`, `Deal`,
`Report`, `Block`, `Notification`, `AuditLog`. These tables exist today so Phase 2–5 work starts from a stable
schema, per the Phase 1 brief's "database model foundations... ready for later phases" requirement. No NestJS
module reads or writes them yet except:

- `Block` — schema exists and `MatchingService` already excludes blocked users from Discover, even though there's
  no API endpoint to create a `Block` row yet.
- `AirportRoom` — a row is auto-created per airport whenever a journey touches it (`JourneysService`), so the
  table is populated and ready, even though there's no chat module reading from it yet.

## Supabase auth vs. Postgres users

Demo/seed accounts are created in Postgres unconditionally. The seed script *also* attempts to create matching
Supabase Auth users (same UUID) via the admin API, but only if `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are
set and reachable — see [`seed.ts`](../packages/db/prisma/seed.ts). If that step is skipped (e.g. no local
Supabase running), the demo rows still exist for API-level testing, but those demo accounts can't sign in until
you create matching Supabase users yourself.
