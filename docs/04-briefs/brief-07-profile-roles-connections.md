# Brief 07 — Profile roles, rider↔trainer connections & billing gates

**For Cursor to build** in the Next.js app (`Vector-Equine/`, Next.js + shadcn/ui + Supabase).
Implements the model in `VE-decision-rider-trainer-model.md`. This brief covers the **data model,
connection/invite flows, permissions, the profile-tab rework, and the billing gates** — it does
**not** re-implement Stripe (reuse the existing `api/payments/*` + webhook plumbing).

Brand: navy `#0E1729` · cream `#FCF2E6` · gold `#D1A955` (flat, no glow) · ink `#1A2133`.
Rider-facing copy rules still apply: never print "AI"; coaching = "Vector"; "works alongside your
trainer"; health flagged, never diagnosed.

**Build order:** STEP A (data model) → B (roles) → C (connections/invites) → D (view-links) →
E (permissions) → F (billing gates) → G (profile UI) → H (verify).

---

## The model in one paragraph (context for Cursor)

Every **rider** carries their own subscription and is the subject of "sessions" (sensor rides,
comms-only lessons, or hybrids). **Trainers coach for free** — they connect to riders, view what's
shared, annotate, assign homework, and run the live comms link, but they can never be the captured
rider without their own rider sub. A paid **Trainer Business** tier adds roster-scale tooling.
First touch is an anonymous **view-only link**; ongoing coaching needs a free trainer account.
Riders control what each trainer can see.

---

## STEP A — Data model (Supabase)

Add/extend tables. Use snake_case, RLS on everything, `user_id` FKs to `auth.users`.

### A1. `profiles` — add role fields
```
role_rider      boolean  default true      -- is this user a rider?
role_trainer    boolean  default false     -- is this user a trainer/coach?
trainer_bio     text     null
trainer_business boolean default false     -- has an active Trainer Business subscription
```
A user can be both a rider and a trainer (common). Do NOT use a single enum — use two booleans so
"both" is native.

### A2. `coach_connections` — the rider↔trainer link
```
id            uuid pk
rider_id      uuid  -> profiles.id   (the paying/captured rider)
trainer_id    uuid  -> profiles.id   (the coaching user)
status        text  -- 'pending' | 'active' | 'declined' | 'removed'
initiated_by  text  -- 'rider' | 'trainer'
share_scope   text  -- 'all' | 'shared_only'   default 'shared_only'
created_at, updated_at
unique(rider_id, trainer_id)
```

### A3. `connection_invites` — invite codes/links
```
id           uuid pk
inviter_id   uuid -> profiles.id
invite_role  text  -- role the RECIPIENT will take: 'rider' | 'trainer'
code         text unique          -- short shareable code, also used in URL
email        text null            -- optional targeted invite
status       text  -- 'open' | 'accepted' | 'expired'
expires_at   timestamptz
created_at
```

### A4. `session_shares` — per-session sharing (when share_scope='shared_only')
```
id           uuid pk
session_id   uuid -> training_sessions.id
trainer_id   uuid -> profiles.id
created_at
unique(session_id, trainer_id)
```

### A5. `share_links` — anonymous view-only links (no account needed)
```
id           uuid pk
session_id   uuid -> training_sessions.id
token        text unique          -- unguessable, used in /shared/[token]
created_by   uuid -> profiles.id
revoked      boolean default false
expires_at   timestamptz null
created_at
```

### A6. `session_source` — extend `training_sessions`
Add a column so the app knows how a session was produced (supports the comms-only wedge):
```
session_source text default 'manual'  -- 'manual' | 'comms' | 'sensor' | 'hybrid'
trainer_id     uuid null -> profiles.id   -- the coach attached to this session, if any
summary        text null                  -- auto/assisted session summary
homework       text null                  -- homework assigned to the rider
```
(No sensor tables here — this brief is roles/connections/billing. Sensor capture is a later brief.)

---

## STEP B — Roles

- **Onboarding**: add a step "How will you use Vector?" with two selectable cards (not exclusive):
  **I ride** (sets `role_rider`) and **I coach** (sets `role_trainer`). Most pick one; allow both.
- Store on `profiles`. A user with only `role_trainer=true` is a **coach-only** account (free).
- Anywhere the app currently assumes "user = rider," branch on role.

---

## STEP C — Connections & invites (two-way)

### C1. Rider invites a trainer
- On the rider's profile / a "My trainer" area: **Invite your trainer** → creates a
  `connection_invites` row (`invite_role='trainer'`) + shareable link `/(invite)/[code]`.
- Trainer opens the link → if logged out, signup/login (free, **no card** for a coach-only
  account) → on accept, create/activate a `coach_connections` row (`initiated_by='rider'`,
  `status='active'`).

### C2. Trainer invites a rider (roster growth)
- On the trainer dashboard: **Invite a rider** → `connection_invites` (`invite_role='rider'`) +
  link. Rider opens → signup → this is a **paying** role, so route them into the rider
  subscription flow (STEP F) as part of/after onboarding. Connection goes `active` once the rider
  account exists (don't hard-block the connection on payment, but gate rider *features* per STEP F).

### C3. Connection management
- Both sides can view their connections and set `status='removed'`. Riders can change
  `share_scope` per connection (all vs shared-only).

---

## STEP D — Anonymous view-only links (the on-ramp)

- On any session/debrief, a rider can **Share a view link** → creates `share_links` row, returns
  `/(shared)/[token]`.
- `/(shared)/[token]` is a **public, read-only** route (no auth) rendering a stripped debrief:
  score, decoded moments, summary, homework — **no** edit controls, no rider PII beyond first
  name + horse name. Respect `revoked` and `expires_at`.
- Include a soft CTA on that page: "Coaching {rider} regularly? Create a free trainer account →"
  (drives D→C conversion). Never print "AI" on this page.

---

## STEP E — Permissions (RLS + app checks)

- A trainer may read a rider's session **iff** an `active` `coach_connections` row exists AND
  (`share_scope='all'` OR a matching `session_shares` row).
- A trainer may **write** coaching artifacts (annotations, `summary`, `homework`, assigned plans)
  on sessions they can read — but may **never** modify the rider's own scores/data ownership.
- Anonymous `/shared/[token]` bypasses auth but is limited to the single session in the token and
  the read-only projection.
- Riders always have full control over their own data and can revoke any trainer or link.

---

## STEP F — Billing gates (reuse existing payments)

The rule: **coaching/viewing is free; being the captured rider is paid; business tooling is paid.**

### F1. Rider gates (require an active rider subscription — Capture/Core/Pro)
Gate these behind an active rider sub (check via existing subscription status):
- Creating/owning a horse profile's **captured** data and starting a **session** (comms, sensor,
  or hybrid) where the user is the rider.
- Viewing their own decoded debrief / insights history beyond a teaser.
- Comms-only lessons count as a captured session → **rider sub required** (this is the
  CeeCoach-replacement; the rider pays even with no hardware).

Free for a rider without a sub: browse, social/feed, connect a trainer, receive a shared link.
(Exact free/paywalled line for the teaser is a product call — leave a clearly-marked
`RIDER_PAYWALL` config point.)

### F2. Trainer coach seat = free
- A `role_trainer` user can connect, view shared sessions, annotate, assign homework, and run
  comms **with no subscription and no card.**
- Add a **soft roster cap** constant `FREE_COACH_MAX_RIDERS = 5` (configurable). At the cap, show
  an upgrade prompt to Trainer Business — do not silently block; make it the conversion moment.

### F3. Trainer Business = paid SKU
- New subscription product **Trainer Business** (own Stripe price id, separate from rider tiers).
  Add it to the products/tiers config alongside the rider tiers. Placeholder price
  `$49/mo` — mark `PRICE_TBD`.
- Unlocks: unlimited roster, multi-client dashboard, cross-client analytics, branded PDF client
  reports, bulk homework/plan assignment. (Scheduling/invoicing = later; stub the nav items as
  "Coming soon.")
- A dual-hat user can hold a **rider sub AND Trainer Business** simultaneously — the two are
  independent. Leave a `BUNDLE_DISCOUNT` config hook (unimplemented) for a future combined price.

---

## STEP G — Profile tab UI

### G1. Rider profile
- Existing profile, plus a **"My coach"** card: connected trainer(s) (avatar, name), pending
  invites, **Invite your trainer** button, and a per-trainer **sharing control** (All rides /
  Only what I share) with a revoke action.

### G2. Trainer profile / dashboard
- A **roster view**: list/grid of connected riders (monogram, name, horse, last session, a small
  status). Tap a rider → their shared sessions + a place to add summary/homework/annotations.
- **Invite a rider** button. Roster count vs `FREE_COACH_MAX_RIDERS` with an upgrade nudge.
- If `trainer_business=false`, show the Business tier upsell (locked analytics/report tiles behind
  a gold "Trainer Business" lock).

### G3. Both-hats users
- A simple toggle at the top of the profile: **Riding | Coaching** to switch between their rider
  self and their coach/roster view. One account, two contexts.

Styling: dark navy workspace, flat gold accents, serif headings, spaced-caps labels — consistent
with brief-02. No cyan, no glows.

---

## STEP H — Verify
- [ ] A coach-only account can sign up free (no card), connect to a rider, and view/annotate a
      shared session — and cannot start a session as the captured rider without a rider sub.
- [ ] A rider can invite a trainer, set share scope (all vs shared-only), and revoke.
- [ ] Anonymous `/shared/[token]` renders read-only, respects revoke/expiry, shows the free-trainer CTA.
- [ ] Comms-only session creation is gated behind a rider sub; `session_source` records correctly.
- [ ] Free coach roster cap triggers the Trainer Business upsell at `FREE_COACH_MAX_RIDERS`.
- [ ] Trainer Business is a distinct SKU; dual-hat user can hold both subs.
- [ ] RLS: a trainer cannot read a non-connected rider, or an unshared session.
- [ ] No "AI" in any rider/trainer-facing copy; "alongside your trainer" line present; health
      language calm. List every file touched.

---

### Cursor prompt
> Apply `brief-07-profile-roles-connections.md`, STEP A→G, then run STEP H. Extend the Supabase
> schema (roles, coach_connections, connection_invites, session_shares, share_links, session_source
> fields) with RLS. Build two-way invites, anonymous view-only `/shared/[token]`, rider-controlled
> sharing, and the profile-tab rework (rider "My coach" card, trainer roster dashboard, both-hats
> toggle). Wire billing gates by reusing the existing `api/payments/*` system: rider features
> require an active rider sub (comms-only sessions included), coaching is free with a
> FREE_COACH_MAX_RIDERS soft cap, and add a distinct Trainer Business SKU (price PRICE_TBD). Do not
> hardcode Stripe prices — add config points (RIDER_PAYWALL, FREE_COACH_MAX_RIDERS, BUNDLE_DISCOUNT).
> Keep brand + copy rules (no "AI", alongside-your-trainer, calm health language). List files touched
> and paste the STEP H checklist results.
