# Roadmap

All five phases below are part of the first release. Phase 1 is complete; this document is the dependency-ordered
task list for Phases 2–5.

## Phase 1 — done

Repository foundation, auth, profiles, flight lookup (mock + Aviationstack adapter), multi-segment journeys with
automatic layover calculation, and traveller discovery (same flight / same departure airport / same layover
airport). See [PRODUCT.md](./PRODUCT.md) and the completion report for details and known limitations.

## Phase 2 — Connections & private messaging — done

- [x] `ConnectionsModule` (NestJS): send/accept/decline/cancel, list (optionally filtered by status), with a
      pure, unit-tested state-machine (`connection-state.util.ts`) deciding what a new request does against
      any existing relationship row — create, auto-accept (if they already requested you), reopen (if
      previously declined/cancelled), or reject (already pending/connected). Blocked users are rejected before
      any of that.
- [x] `MessagingModule`: paginated REST history (`GET /connections/:id/messages`), send (`POST .../messages`),
      mark-read (`POST .../messages/read`), and a push-only Socket.IO gateway (`MESSAGE_NEW` / `MESSAGE_READ`) —
      REST is the only write path; the gateway just notifies whichever participants are currently connected, so
      validation lives in one place.
- [x] Socket.IO auth: the gateway verifies the bearer token via the same `SupabaseService.verifyAccessToken`
      the REST guard uses, then joins the socket to a `user:<id>` room.
- [x] Traveller app: real Chats tab (requests / messages / sent, with unread badges and live updates), a 1:1
      chat screen (`app/chat/[connectionId].tsx`), and Discover's "Connect" button now calls the real endpoint.
- [x] Tests: connection state machine (create / auto-accept / reopen / reject, including both "already
      connected" and "already pending" rejection paths).
- [ ] Image messages and push notifications: left for a later pass — the brief only asks that the design not
      preclude them, not that they ship now.

## Phase 3 — Airport group rooms — done

- [x] `AirportRoomsModule`: server-side eligibility reuses `computePresenceWindows` from Matching (not
      re-implemented) via a shared `computeUserRoomAccessWindows` function — a user may read/post only while
      within `[presence_start - accessWindowHoursBefore, presence_end + accessWindowHoursAfter]` at that airport.
      Visibility is separate from eligibility: a room shows up in `GET /airport-rooms` whenever a journey
      touches that airport at all, marked `eligible: false` with an `accessWindowStartUtc` so the client can say
      "opens at…", but reading/posting 403s until the window is actually active.
- [x] Cursor-paginated message history (`GET /airport-rooms/:iata/messages?cursor=&limit=`) so a new participant
      is never sent a room's full history — plus a push-only Socket.IO channel (`airport-room:<iata>`) for new
      messages, joined via a `room:join` socket event that's re-validated against the same eligibility check as
      the REST endpoints (so a socket can't receive live traffic for a room it isn't actually eligible for).
- [x] Moderation hooks: this phase is what actually built the `Report`/`Block` infrastructure Phase 1–2 only
      used internally for filtering — see the new `SafetyModule` below.
- [x] Message retention: a daily cron (`AirportRoomRetentionService`, `@nestjs/schedule`) prunes room messages
      older than `AIRPORT_ROOM_MESSAGE_RETENTION_DAYS` (default 90). Private `Message` rows are never pruned.
- [x] Traveller app: real Airport Hub tab (eligible rooms first, "opens at…" for the rest), a group chat screen
      with sender names and a "load older messages" control, and long-press-to-report on messages.
- [x] `SafetyModule` (new, not originally scoped to Phase 3 but required for "moderation hooks"): `POST /blocks`,
      `DELETE /blocks/:userId`, `GET /blocks`, and `POST /reports`. Wired into `MatchingService` (replacing its
      own duplicate query), `ConnectionsService` (block check before sending a request), and `MessagingService`
      (re-checked on every send, since a block can happen *after* a connection was accepted). The traveller app's
      DM chat screen also got a "Block" header action and long-press-to-report, for consistency with rooms.
- [x] Tests: room access window math (active / not-yet-open / expired, including the "opens N hours before
      actual arrival" behaviour that supports planning a meetup ahead of time).

## Phase 4 — Deals, business portal, moderation — done

- [x] `BusinessesModule`: self-registration (`POST /businesses`, status `PENDING`), `GET /businesses/me`, and an
      admin approval queue (`GET /businesses?status=`, `PATCH /businesses/:id/{approve,reject,suspend,reinstate}`
      guarded by a new `AdminGuard`). Status transitions are decided by a pure, unit-tested state machine
      (`business-status.util.ts`), same pattern as Phase 2's connection state machine.
- [x] `DealsModule`: business submission (`POST /deals`, defaults to the caller's one approved business if
      they only have one, otherwise `businessId` is required), admin approve/reject
      (`PATCH /deals/:id/moderate`, admin-only), edit (`PATCH /deals/:id` — a non-admin edit always resets
      status to `PENDING` for re-review, even on an already-approved deal), and delete. A daily cron
      (`DealExpiryService`) flips lapsed `APPROVED` deals to `EXPIRED`, mirroring the airport-room retention
      cron from Phase 3.
- [x] Traveller-facing read endpoint (`GET /deals/for-me`): approved + currently valid deals, scoped server-side
      to the airports the caller's *own* journeys actually touch (any journey, not just discoverable ones —
      unlike airport rooms, browsing deals needs no eligibility window) — exactly the filter described in
      `packages/contracts/src/deal.ts`.
- [x] Admin portal: `/dashboard/deals` and `/dashboard/businesses` now show real, status-filterable queues with
      approve/reject/suspend/reinstate actions; the Overview page's pending-deal/pending-business stat cards are
      wired to real counts.
- [x] Business portal: rather than a separate app, the existing admin-portal now branches by role (`GET /me` →
      `isAdmin`) — a non-admin signed-in user sees a business-owner view instead of the admin nav/pages: register
      a business, see its approval status, and (once approved) submit/edit/delete its deals. This matches the
      login page's existing "administrator or approved business account" copy from Phase 1. Reports moderation
      UI is explicitly out of scope here (the `Report`/`Block` backend from Phase 3 has no admin review UI yet).
- [x] Traveller app: the Deals tab lists real deals grouped by airport, reusing the same empty/loading/error
      states as the rest of the app.
- [x] No payments, no real partnerships — promo codes and published offers only, as scoped.

## Phase 5 — Notifications, security review, E2E, performance, deployment — mostly done

This phase bundled five fairly different workstreams, done across two passes. The first covered the
core, buildable-without-an-infra-decision items: notifications, account deletion, audit log coverage,
and a CI pipeline. The second covered the security review, E2E tests, and the matching-query
performance read. Only production deployment remains — it needs a target platform decision (where
this actually runs) that's the user's call, not something to guess at; see its note below.

- [x] `NotificationsModule`: a generic in-app notification feed (`GET /notifications`, cursor-paginated,
      `POST /notifications/:id/read`, `POST /notifications/read-all`) backed by the existing `Notification`
      model, pushed live over the same per-user Socket.IO room messaging already uses (`notification:new`).
      Scoped to events with no other visibility in-app: a connection request received or accepted (messaging
      itself already covers new-message visibility via the Chats tab's own badges, so it isn't duplicated
      here), and business/deal status changes from Phase 4 moderation — the one place a business owner
      otherwise had to keep re-checking the business portal to find out. Traveller app: a bell icon with an
      unread badge on Discover, and a `/notifications` screen. Expo push tokens are still left for later —
      no physical device to register one against in this environment, and the in-app feed is the prerequisite
      for push to notify about anyway.
- [x] Account/data deletion workflow: `DELETE /me` soft-deletes the caller's own account (`User.status` →
      `DELETED`, `deletedAt` set). No new filtering logic was needed elsewhere — `SupabaseAuthGuard` already
      rejects any non-`ACTIVE` user on their next request, and `MatchingService` already filters candidates to
      `status: 'ACTIVE'`, so a deleted user already stops appearing anywhere the moment they're flagged. Rows
      are kept, not erased, consistent with every other delete in this codebase. Traveller app: "Delete my
      account" in Settings, replacing the earlier placeholder text, with the same confirm-dialog pattern used
      for removing a journey.
- [x] Audit log coverage: a new global `AuditLogService` (parallel to `PrismaModule`'s pattern) is now called
      from both Phase 4 admin actions — `BusinessesService.applyStatusAction` and `DealsService.moderate` —
      recording the acting admin, the action, and before/after state. Further admin actions (there are only
      these two today) should call it the same way as they're added.
- [x] CI pipeline (`.github/workflows/ci.yml`): typecheck, lint, and test on every PR and push to `main`,
      across all 6 packages via Turborepo. Needs no database or Supabase instance — every current test is a
      pure-function unit test, and `prisma generate` only needs the schema file, not a live connection.
- [x] Security review:
  - **Dependency audit** (`pnpm audit --prod`): started at 65 advisories (4 critical, 23 high). Closed down to
    37 (3 critical, 12 high) with no breaking changes: `next` 14.2.18 → 14.2.35 (closes the critical middleware
    authorization-bypass advisory and most of the rest — the admin-portal uses no `middleware.ts`, Server
    Actions, or `next/image`, which also narrows real exposure from the framework-internal findings generally),
    plus pinned `pnpm.overrides` for `body-parser`, `multer`, `qs`, `lodash`, and `uuid` to their patched
    versions (all transitively pulled in by `@nestjs/*`/Express). Remaining 3 critical advisories are Next.js
    findings only fixed in the 15.x line — a major version bump with real regression risk (React 19, config
    changes) that deserves its own dedicated pass rather than being rushed into this one. `zod`'s one high
    advisory (memory exhaustion on oversized input) similarly only has a fix in Zod 4, a breaking rewrite of
    every schema in `packages/contracts` — flagged, not attempted here.
  - **Rate-limit tuning**: added per-route `@Throttle()` overrides below the global 120/min default on the
    endpoints actually worth abuse-proofing individually — `POST /businesses` (5/min), `POST /connections`
    (20/min), `POST /reports` (10/min). Sign-in/sign-up aren't our endpoints to tune — Supabase Auth owns those
    and has its own limits.
  - **Cross-cutting authorization pass**: walked every controller. Every mutating endpoint either checks
    resource ownership in its service (journeys, deals, connections, messaging — all confirmed to compare the
    row's owner/participant against the caller, not just filter by it) or is behind `AdminGuard`. Confirmed
    `ZodValidationPipe`'s `safeParse` already strips unknown body fields (Zod's default `.object()` behavior),
    so mass-assignment isn't a gap. Confirmed the admin-portal's role-branching UI is cosmetic only — the real
    boundary is server-side (`AdminGuard`), matching `AuthGate.tsx`'s own existing comment about this.
  - **Secrets handling**: confirmed only `.env.example` files are tracked in git (no real `.env`/`.env.local`
    anywhere in history), the Supabase service-role key is never constructed outside `SupabaseService` and
    never sent to any frontend, and token verification always goes through Supabase's own `auth.getUser()`
    rather than manually decoding a JWT.
  - Added `helmet()` to the API (`main.ts`) for standard security headers (`X-Content-Type-Options`,
    `X-Frame-Options`, etc.) — wasn't present before.
- [x] Performance: read `MatchingService.findCandidateJourneyIds` closely. `Flight` already has the composite
      indexes this query needs (`(departureAirportIata, scheduledDepartureUtc)`,
      `(arrivalAirportIata, scheduledArrivalUtc)`), and `JourneySegment.flightId` is indexed — the "two `IN`
      queries" note undersold it: both queries were already index-driven. Merged them into one query (single
      `OR` across the same `journeySegment` table, `distinct: ['journeyId']` instead of a JS `Set`) — strictly
      fewer round-trips, same results (verified against real fixture data, not just the unit tests). The actual
      scaling concern — computing matches in application code over every candidate row rather than in SQL —
      is architectural, not a query bug, and still needs real data volume to justify the materialised
      presence-window table redesign before that's worth building; that part remains deferred, unchanged from
      the original note.
- [x] End-to-end tests: Playwright added for the admin portal (`apps/admin-portal/e2e/`, `pnpm test:e2e`),
      covering login/role-branching (admin nav vs. business portal vs. invalid credentials) and the full Phase 4
      moderation loop end-to-end through real UI interaction — register a business → admin approves it → submit
      a deal → admin approves that too. Needs the full local stack already running (Supabase/Postgres/Redis +
      the API) — Playwright only starts the admin-portal's own dev server. Writing these tests surfaced a real,
      pre-existing bug: the login page's `<label>` elements were never actually associated with their inputs
      (no `htmlFor`/`id`, not wrapped) — worked visually, broke for screen readers and for Playwright's
      `getByLabel()` alike. Fixed. Not wired into CI in this pass (would need Postgres/Supabase/Redis service
      containers in the GitHub Actions runner — a separate, deliberate piece of work). Detox for the traveller
      app remains deferred — it needs a real emulator/device and native build tooling this environment doesn't
      have.
- [ ] Production readiness: structured logging, health checks beyond `/health`, and deployment configuration
      (containerization, environment-specific config) need a target platform decision first (where this
      actually runs) that wasn't made in this pass.

## Explicitly not planned without a product decision first

- Payments / real commercial deal partnerships.
- Google/Apple social login (Supabase supports it; the auth flow in this codebase was written so adding a
  provider is additive, not a rewrite — see `apps/traveller/src/lib/auth-context.tsx`).
- Live location tracking (the brief explicitly excludes this).
