# Roadmap

All five phases below are part of the first release. Phase 1 is complete; this document is the dependency-ordered
task list for Phases 2–5.

## Phase 1 — done

Repository foundation, auth, profiles, flight lookup (mock + Aviationstack adapter), multi-segment journeys with
automatic layover calculation, and traveller discovery (same flight / same departure airport / same layover
airport). See [PRODUCT.md](./PRODUCT.md) and the completion report for details and known limitations.

## Phase 2 — Connections & private messaging

Depends on: Phase 1's `Match`/`PublicProfile` contracts (already shaped to carry a `connectionStatus`), the
`Connection`/`Message` Prisma models (already defined), `packages/contracts/src/connection.ts` and `message.ts`
(already defined).

- [ ] `ConnectionsModule` (NestJS): send/accept/decline/cancel, list pending/accepted, enforce one pending
      request per direction (unique constraint already in schema).
- [ ] `MessagingModule`: REST history endpoint + Socket.IO gateway for real-time delivery; unread counts.
- [ ] Socket.IO auth: reuse `SupabaseAuthGuard`'s token verification for the WS handshake.
- [ ] Traveller app: replace the Chats tab placeholder with connection list + 1:1 chat UI; wire the Discover
      "Connect" button to the real endpoint (currently shows a "coming soon" alert).
- [ ] Image messages and push notifications: data model and UI should leave room (e.g. a `Message.attachmentUrl`
      column) but are not required for Phase 2 itself per the brief ("design for future support... without
      implementing unnecessary complexity now").
- [ ] Tests: connection state machine, message ordering/pagination, blocked-user message rejection.

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
