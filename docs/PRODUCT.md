# Product: Layo

> "Layo" is a temporary working name. See [DECISIONS.md](./DECISIONS.md#brand-name) for how to rebrand.

## Vision

Layo helps air travellers discover and connect with people who are:

1. **Taking the same flight** (including codeshare-equivalent flight numbers).
2. **Departing from the same airport** around the same time.
3. **Having an overlapping layover at the same airport** — even when flying to completely different final destinations.

Once discovered, users can send a connection request, chat privately once accepted, join a persistent per-airport
group chat, and browse offers from shops, lounges and restaurants at airports along their journey.

## Who it's for

- A business traveller who'd rather not spend a 3-hour layover alone.
- Friends who end up on the same long-haul flight by coincidence and want to coordinate seating or just say hi.
- Someone relocating internationally who wants a friendly face during a stressful multi-leg trip.

## Primary flows (Phase 1 + 2 + 3 scope)

- **Sign up / sign in** — email + password via Supabase Auth, 18+ enforced at signup.
- **Profile setup** — display name, private date of birth (only age is ever shown publicly), bio, interests,
  languages, optional home city, discovery opt-in.
- **Add a journey** — look up a flight by number + date, confirm the correct result from a list of candidates
  (or fall back to a clearly labelled unverified manual entry), add further connecting segments, and see
  automatically calculated layovers.
- **Discover** — see other travellers matching one of the three categories above, with the overlap window and a
  clear notice that in-person meeting accessibility is never assumed or guaranteed.
- **Connect & chat** — send a connection request from Discover (or accept one someone sent you), then message
  privately once accepted, with live delivery over Socket.IO.
- **Airport Hub** — join the persistent group chat for any airport your journeys touch, once you're within its
  access window (which opens ahead of your actual arrival, so you can plan a meetup). Report a message or block
  someone from either a private or a room chat.

## Explicitly out of scope so far (see [ROADMAP.md](./ROADMAP.md))

- Airport deals and the business/admin approval workflow (Phase 4) — the admin portal exists as a protected
  foundation, and the data model is ready, but there's no working deal submission/approval flow yet.
- Admin review of filed reports (you can file one; nobody's reviewed it yet) — that's Phase 4/5 admin-portal work.
- Push notifications, full security review, E2E test suite, deployment (Phase 5).

The traveller app has all five tabs — Discover, Journeys, Chats and Airport Hub are fully functional; Deals shows
an honest "coming soon" placeholder rather than fake functionality.

## Safety and privacy commitments

- Nobody under 18 can register.
- Date of birth, email and other contact details are never exposed to other users — only a computed age.
- Discoverability is strictly opt-in (profile-level and per-journey).
- Flight number + date does not prove someone holds a ticket — schedule data and passenger verification are kept
  conceptually and architecturally separate (see [DECISIONS.md](./DECISIONS.md#schedule-vs-passenger-verification)).
- Meeting up in person is never presented as guaranteed — terminal/airside connectivity is explicitly unconfirmed
  on every match, always (see [DECISIONS.md](./DECISIONS.md#meeting-accessibility-is-always-unconfirmed)).
