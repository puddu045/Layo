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

## Phase 5 — Notifications, security review, E2E, performance, deployment

This phase bundles five fairly different workstreams. The first pass (below) covers the core,
buildable-without-an-infra-decision items: notifications, account deletion, audit log coverage, and
a CI pipeline. The rest — a full security review, E2E tests, the matching-query performance work,
and production deployment — are left for a deliberate follow-up pass; see the notes under each.

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
- [ ] Security review: deferred as a deliberate, standalone pass rather than folded into this one — it reads
      best as a review of the finished surface area (seven modules deep now) rather than something to redo
      after every future phase. Use the `security-review` or `code-review` skill against the full branch/diff
      when ready, covering: rate-limit tuning beyond the current global Throttler default, a dependency audit,
      the cross-cutting authorization pass (ownership checks already exist per-module; this is about verifying
      there's no gap between them), and secrets handling.
- [ ] End-to-end tests (Detox for the traveller app, Playwright for the admin portal): deferred. Detox needs a
      real emulator/device and native build tooling this environment doesn't have; Playwright against the
      admin-portal is realistic to add in a focused follow-up, now that there's real role-branching UI
      (admin queues, business portal) worth covering, but wasn't started here to keep this pass to the items
      with no external tooling dependency.
- [ ] Performance: the matching service's candidate query (`MatchingService.findCandidateJourneyIds`) is
      reasonable for a demo-scale dataset but does two `IN` queries over journey segments; revisit with real
      data volume (likely: materialised presence-window table + indexed range queries) before this matters —
      unchanged from the original note, since nothing in this pass added matching load.
- [ ] Production readiness beyond CI: structured logging, health checks beyond `/health`, and deployment
      configuration (containerization, environment-specific config) need a target platform decision first
      (where this actually runs) that wasn't made in this pass — the CI pipeline above is deployment-adjacent
      but deliberately stops short of deploying anywhere.

## Explicitly not planned without a product decision first

- Payments / real commercial deal partnerships.
- Google/Apple social login (Supabase supports it; the auth flow in this codebase was written so adding a
  provider is additive, not a rewrite — see `apps/traveller/src/lib/auth-context.tsx`).
- Live location tracking (the brief explicitly excludes this).
