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

## Phase 3 — Airport group rooms

Depends on: `AirportRoom`/`AirportRoomMembership`/`AirportRoomMessage` models (already defined and auto-populated
per airport by `JourneysService`), `DEFAULT_MATCHING_CONFIG.airportRoomAccessWindowHours*`
(`packages/config/src/matching.ts`, already defined but unused until this phase).

- [ ] `AirportRoomsModule`: server-side eligibility check using the same presence-window logic as Matching
      (reuse `computePresenceWindows`, don't re-implement it) — a user may read/post only while within
      `[presence_start - accessWindowHoursBefore, presence_end + accessWindowHoursAfter]` at that airport.
- [ ] Paginated message history designed for large rooms (brief requirement: "handle large rooms without
      sending the full history to every new participant") — cursor-based pagination + Socket.IO for new
      messages only.
- [ ] Moderation hooks: reporting/blocking inside a room reuses the Phase 2 `Report`/`Block` infrastructure.
- [ ] Message retention policy (scheduled job to prune old room messages).
- [ ] Traveller app: replace the Airport Hub tab placeholder.

## Phase 4 — Deals, business portal, moderation

Depends on: `Business`/`Deal` models (already defined), admin portal's protected `(dashboard)` layout (already
built), `packages/contracts/src/deal.ts` / `business.ts` (already defined).

- [ ] `BusinessesModule`: business self-registration, admin approval queue.
- [ ] `DealsModule`: business submission, admin approve/reject, public read endpoint (approved + active +
      within validity window only — exactly the filter already described in
      `packages/contracts/src/deal.ts`).
- [ ] Admin portal: wire `/dashboard/deals` and `/dashboard/businesses` (currently static placeholders) to real
      data with approve/reject actions.
- [ ] Business portal: a protected dashboard for approved businesses to submit/edit their own deals.
- [ ] Traveller app: replace the Deals tab placeholder with a real per-airport offers list.
- [ ] No payments, no real partnerships for this phase (per the brief) — promo codes and published offers only.

## Phase 5 — Notifications, security review, E2E, performance, deployment

- [ ] `NotificationsModule`: in-app notification feed backed by the existing `Notification` model; push
      notifications (Expo push tokens) once Phase 2/3 messaging exists to notify about.
- [ ] Security review: rate-limit tuning beyond the current global Throttler default, dependency audit, a pass
      over every endpoint for authorization (ownership checks already exist per-module — this is the
      cross-cutting review), secrets handling review.
- [ ] Account/data deletion workflow (the brief requires this — schema supports soft-delete via `User.status` /
      `deletedAt`, but there's no user-facing flow yet).
- [ ] Audit log coverage: `AuditLog` model exists; no admin action writes to it yet — add as each Phase 4/5
      admin action is built.
- [ ] End-to-end tests (e.g. Detox for the traveller app, Playwright for the admin portal) covering sign-up →
      profile → journey → discover → connect → chat → room → deal, once those phases exist.
- [ ] Performance: the matching service's candidate query (`MatchingService.findCandidateJourneyIds`) is
      reasonable for a demo-scale dataset but does two `IN` queries over journey segments; revisit with real
      data volume (likely: materialised presence-window table + indexed range queries) before this matters.
  - [ ] Production readiness: structured logging, health checks beyond `/health`, deployment configuration
        (containerization, environment-specific config), CI pipeline (typecheck/lint/test on PR).

## Explicitly not planned without a product decision first

- Payments / real commercial deal partnerships.
- Google/Apple social login (Supabase supports it; the auth flow in this codebase was written so adding a
  provider is additive, not a rewrite — see `apps/traveller/src/lib/auth-context.tsx`).
- Live location tracking (the brief explicitly excludes this).
