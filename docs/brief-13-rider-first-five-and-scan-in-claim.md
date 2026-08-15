# Brief 13 — Ship-ready for riders: cut the unreal, tighten the first five minutes, claim the trainer

**For Cursor to build** in `Vector-Equine/` (Next.js App Router + Supabase + Tailwind/shadcn).
**Goal: a version a paying rider can be sold today**, with nothing on screen that doesn't work.

Three jobs, one funnel:

1. **Ship-ready pass.** Everything not real is flagged off or deleted. No "Coming soon" reaches a
   rider.
2. **The rider's first five minutes.** Today it's two forms and a four-step wizard before value.
3. **The scan-in claim.** The trainer who scans in is currently a ghost. Make them an account and
   hand them the lesson they just taught.

**Governing decision:** `VE-decision-rider-trainer-model.md`, including §10 (2026-08-14):
coaching is free, uncapped, indefinitely; **data capture outranks trainer monetization**; a
trainer with no account receives nothing; the lesson a coach personally taught auto-shares on
claim; everything else needs rider approval.
**Repo rules:** `VE-repo-CLAUDE-md.md`. Absolute: never render "AI", health is flagged never
diagnosed, the app never grades the rider, verify at 390px.

**Build order:** A (ship-ready) → B (deletions) → C (onboarding) → D (baseline gate) →
E (claim schema) → F (claim API) → G (claim UI) → H (sharing) → I (clinic) → J (verify).

---

## What's actually there today (read before changing anything)

Verified in the repo 2026-08-14.

**Already built — do not rebuild:**
- **Roles/connections (brief-07).** `20260719000000_roles_connections_shares.sql`,
  `20260719000002_trainer_business_tier.sql`, `/api/connections/*`, `/profile/coach/[riderId]`.
- **Feature flags with a stage ladder.** `20260625000000_feature_flags_and_cohorts.sql` gives
  `feature_flags` (`off → internal → closed_beta → open_beta → ga` + rollout %),
  `feature_flag_overrides` (per-user allow/deny), `profiles.is_beta_tester`,
  `src/lib/flags/{registry,evaluate,guards,server,context}`, and an admin control panel.
  **This is the answer to "how do I hide unfinished work" — not separate accounts, not a separate
  app.**

**The rider's current path:** `/signup` → `/(auth)/onboarding` (role cards, username, display
name, location, discipline, rider level) → `/train` → no horse → "Continue setup" →
`/train/setup` → `VectorSetupWizard` (You · Horse · Together · Health) → `/train` → start dial →
`/train/ride/live`.

**The claim gap:** `POST /api/capture/join/[code]` issues a guest LiveKit token and writes
`capture_sessions.trainer_display_name` as a **plain string**. No profile row, no
`coach_connections` row, no way back. The trainer coaches a lesson, generates the transcript that
feeds the models, and vanishes. Two systems sit side by side and never touch. **This brief is the
bridge.**

---

## STEP A — Ship-ready pass

**The rule: a rider sees a finished product or nothing. Never a preview of one.**
"Coming soon" tells someone paying $59/mo that they bought a partial product. It is worse than an
absent feature, and it violates the standing progressive-disclosure rule (never render an empty
module — hide it until there's data).

### A1. Extend the flag registry
Add to `src/lib/flags/registry.ts`, each `defaultStage: "off"`, plus a seed migration:

| Key | Gates |
|---|---|
| `sensor_capture` | Anything sensor-derived: aid reads, decoded moments, sweet-spot UI |
| `horse_health` | Load, recovery, symmetry — the whole health surface |
| `events_shows` | Events / shows, if not production-ready |
| `trainer_business` | The paid back-office SKU (§10.2 — back-office only, never coaching) |
| `coach_claim` | This brief's STEP E–H. Start `internal`. |
| `clinic_batch` | STEP I. Start `internal`. |

Existing `training_diary`, `ai_video_analysis`, `ai_highlight_reel` stay; audit each one's real
stage before launch. Rename the two `ai_*` keys to `video_analysis` and `highlight_reel` — the
no-"AI" rule is about rendered copy, but the key leaks into admin UI and debug output.

### A2. Flag-off means absent, not disabled
`components/shared/mobile-nav.tsx` and `main-nav.tsx` currently render blocked items greyed out
with `title="Coming soon"` and a "Coming soon" badge.
- **Remove the disabled-item branches entirely.** When a flag is off for the viewer, the nav item
  is not rendered. Same for `components/profile/coaching-panel.tsx:474` and
  `components/train/debrief-coming-soon.tsx`.
- Keep `debrief-coming-soon.tsx` in the repo only if it's used for an *in-progress* debrief that
  will arrive in minutes. If it means "this feature doesn't exist," delete it.

### A3. Delete the fabricated health block — do not flag it, delete it
`app/(main)/train/page.tsx` ~line 370 renders, unconditionally and hardcoded:

```
{/* TODO: real load/recovery from biosensor aggregates when available */}
Load is balanced. Recovery trending up.
[3 of 5 gold bars, hardcoded]
```

A rider reads this as a statement about their horse. It is invented. It breaks *health is flagged,
never diagnosed*, and it is the kind of thing that is fine until the day a horse is not fine.
Remove the heading, the sentence, and the meter. When `horse_health` ships, the section renders
only with real aggregates behind it.

### A4. How to run unfinished work — the structure
No separate accounts. No second app. No parallel rider database.

- **One production app, one codebase.** Riders see only `ga` (and `open_beta` where you want
  rollout %).
- **Your own work runs at `stage='internal'`** with a `feature_flag_overrides` row for your user.
  Same production data, same URLs, nothing visible to riders.
- **Beta trainers/riders** get `is_beta_tester = true` and `closed_beta` flags.
- **A second Supabase project for development**, pointed at by `.env.local` / a Vercel preview
  environment on a `dev` branch. Use it for schema changes and destructive testing — never for
  hiding features. Flags hide features; environments protect data.

Anything not yet real is a flag at `off` or `internal`. That's the whole structure.

---

## STEP B — Deletions and collapses

### B1. `/train/ai-trainer/*` — remove
`app/(main)/train/ai-trainer/{page,[videoId]/page,[videoId]/chat/page}.tsx` mirror
`train/ride/plan/*` exactly (same `[videoId]` + `/chat` shape). It's the pre-rename surface, and
the route name breaks the no-"AI" rule. Delete; add permanent redirects to `/train/ride/plan/*`.
Grep for `ai-trainer` and `ai-upload-form` imports first.

### B2. Two horse surfaces — collapse to one
`train/horse/page.tsx` ("Your horse room", 442 lines) and `train/horses/page.tsx` ("Roster") are
two answers to one question.
- **Keep** `/train/horses` (list) and `/train/horses/[id]` (single-horse timeline).
- **Fold** the horse-room content into `/train/horses/[id]`. Redirect `/train/horse` → the active
  horse's `/train/horses/[id]`.
- Rationale: *the ride is a moment, the horse is a timeline.* One timeline per horse.

### B3. Two horse-creation paths — collapse to one
`VectorSetupWizard` step 1 and `/train/horses/new` both write `horse_profiles` with different
fields. Route both through the existing `components/train/horse-form.tsx`. **One code path that
writes a horse.**

---

## STEP C — Collapse onboarding into the wizard

`(auth)/onboarding/page.tsx` and `components/train/vector-setup-wizard.tsx` each define their own
`DISCIPLINES` and `RIDER_LEVELS` and each ask discipline + level — the same two questions, twice,
ninety seconds apart.

- Move both arrays to `lib/constants/rider.ts`. One definition.
- **Remove discipline, rider level, and location from `/onboarding`.** The wizard asks the first
  two; location moves to profile settings.
- **Onboarding keeps three fields:** role cards (I ride / I coach), username, display name.
- The `coachOnly` branch that stamps `vector_setup_completed_at` and skips the horse wizard is
  correct — keep it.

---

## STEP D — Soften the baseline gate

Four wizard steps (You · Horse · Together · Health) currently stand between a new rider and their
first ride, before they have reason to believe the answers matter. **Do not delete the baseline** —
`20260720000000_vector_setup_baseline.sql` exists because the intelligence needs a starting place.
Change *when* it's asked.

- **Required to start:** horse name. On submit, create the horse and land on `/train` with a live
  start dial.
- **Deferred:** the rest of You, Together, Health. Track `vector_setup_step` on the profile so the
  wizard is resumable, not just completed/not-completed.
- **Ask after the first completed session**, one invitation above the fold:

  > **Set your starting place**
  > *Vector reads the change. It needs to know where you started.*
  > → Finish setup (2 min)

  Dismissible; reappears after ride 3 if still incomplete.
- The Health step is gated by `horse_health` (STEP A1). If that flag is off, the step does not
  render at all.

**Target path:** `signup → username + display name + "I ride" → horse name → START`. Four fields.

---

## STEP E — Claim schema

New migration `20260814000000_capture_trainer_claim.sql`.

### E1. `capture_sessions` — add
```
trainer_id        uuid null references profiles(id)  -- set when a signed-in coach joins or claims
claim_token       text unique null                   -- unguessable; lets a guest claim after the fact
claim_expires_at  timestamptz null                   -- default now() + 7 days
claimed_at        timestamptz null
```
Keep `trainer_display_name` — it remains the label for a guest who never claims.

### E2. `coach_connections` — one new value
Add `initiated_by = 'capture'` alongside `'rider'` / `'trainer'`, so the flywheel is measurable.
No new table: a claim produces an ordinary `coach_connections` row.

### E3. RLS
- The claim endpoints run through the admin client, gated on `claim_token` + expiry only.
- **A coach may always read a capture session where `trainer_id = auth.uid()`**, regardless of
  connection status — they taught it (§10.4).
- Access to the rider's *other* sessions continues to use the existing brief-07 policies. Write no
  new read policies for those.

---

## STEP F — Claim API

### F1. `POST /api/capture/join/[code]` — return a claim token
Generate `claim_token` at guest join and return it alongside `guest_token`. No behaviour change to
the join itself.

### F2. `GET /api/capture/claim/[token]`
Public. Returns rider display name, horse name, lesson date, duration, and token validity — **and
a teaser only**: the focus line and counts (e.g. "3 corrections captured"). Never the full
debrief. Per §10.4, an unclaimed trainer receives nothing.

### F3. `POST /api/capture/claim/[token]`
Requires an authenticated user.
1. Validate token, expiry, not already claimed.
2. Set `capture_sessions.trainer_id = auth.uid()`, `claimed_at = now()`.
3. Ensure `profiles.role_trainer = true`.
4. Upsert `coach_connections` (`rider_id` from the capture session, `trainer_id = auth.uid()`,
   `status = 'pending'`, `initiated_by = 'capture'`, `share_scope = 'shared_only'`).
5. Notify the rider (STEP H).
6. **That lesson is immediately readable by the coach** — no rider approval, no waiting.

**No payment check anywhere in this path**, and **no roster-size check** (§10.1 — the cap is
removed). A coach with 40 riders is not blocked.

---

## STEP G — Claim UI (the conversion moment)

### G1. Nothing goes in front of the lesson
`/(join)/join/[code]` stays exactly as it is: enter a name, tap **Join with microphone**, coach.
It works, clinics depend on it, capture outranks conversion (§10.3). At most one quiet line under
the join button: *"Coaching here often? You can save this after the lesson."*

### G2. The ask lands when the lesson ends
On `onLessonClosed`, replace the guest view with one screen:

> **VECTOR**
> **{Rider}'s lesson is written up.**
> *Three corrections, the work, and the homework you set.*
>
> [ Create a free coach account to open it ] ← primary
> Not now → (dismiss; token stays valid 7 days)

The teaser shows the focus line and the counts — enough to be worth wanting, not the thing itself.
Style: navy `AtmosphereScreen`, serif headline, one gold italic line, flat gold primary button. No
bordered cards. Never print "AI".

### G3. Signup carrying the claim
`/signup?claim={token}` → signup → onboarding **pre-selects "I coach"**, skips discipline/level,
asks username + display name only (display name pre-filled with the guest name they typed at
join) → posts the claim → lands **directly on that lesson's debrief**, with the roster behind it
showing the rider as *Pending*.

That landing matters: the coach's first screen after signup is the thing they were promised, not
an empty roster.

### G4. A signed-in coach who scans in
If a `role_trainer` user is already authenticated at `/join/[code]`, skip the name field, set
`trainer_id` at join, and create the pending connection immediately. Name comes from their profile.

---

## STEP H — What the coach gets, and what needs approval

### H1. Auto-shared on claim — the lesson they taught
Full debrief for that session: the summary, the corrections, the homework, the transcript-derived
work line, and their own annotations. No gate. They were in it.

**Organize it as the lesson, not as a data dump.** One session view, in this order:
the work → what was said (corrections, attributed to the coach by name) → homework set →
rider's own feel, if they've answered it. Measurement content stays in its own zone, stated flat,
drawing no conclusions — the two-voices rule is not optional here.

### H2. Everything else — rider approves
Notification plus an item on the rider's Vector home and profile:

> *"Emma Clark coached your lesson on Aug 14. Let her see your other rides?"*
> **All rides** · **Only what I share** · **No**

- Approving sets `status='active'` and the chosen `share_scope`.
- Declining leaves the coach with exactly the one lesson they taught. That is the correct floor —
  never zero, never everything.
- Revoke stays where brief-07 put it: one tap, no confirmation chain.
- **Preselect "All rides"** in the rider's approval UI. A coach staring at a one-session roster
  concludes the product is thin, and revoke is always one tap away.

---

## STEP I — Clinic mode

A clinician scans into eight riders in a day. Eight claim prompts is spam.

- If the same claim holder (or authenticated coach) closes **2+ lessons within 12 hours**,
  suppress the end-of-lesson prompt after the first dismissal.
- One screen on the last lesson close:
  > **You coached 6 riders today.**
  > *Open the write-ups. Connect with the riders.*
  > [ list with checkboxes, all checked ] → **Create account & open all**
- Each checked rider produces one claimed session (auto-shared) + one pending connection.
- Gated by `clinic_batch`, starting at `internal`.

This is how a clinician acquires a roster in an afternoon. It costs one screen.

---

## STEP J — Verify

**Ship-ready**
- [ ] No "Coming soon" string renders anywhere in the rider-facing app.
- [ ] Flag-off surfaces are absent from nav, not greyed out.
- [ ] The hardcoded "Load is balanced. Recovery trending up." block and its meter are gone.
- [ ] `sensor_capture`, `horse_health`, `events_shows`, `trainer_business`, `coach_claim`,
      `clinic_batch` exist in the registry and are seeded; all default `off`/`internal`.
- [ ] A rider account with no overrides sees only finished surfaces.

**Rider first five**
- [ ] `/train/ai-trainer/*` gone; redirects land on `/train/ride/plan/*`; no stale imports.
- [ ] `/train/horse` redirects to the active horse's `/train/horses/[id]`; content preserved.
- [ ] One code path creates a `horse_profiles` row.
- [ ] `DISCIPLINES` / `RIDER_LEVELS` defined once in `lib/constants/rider.ts`.
- [ ] A new rider reaches a live start dial in **4 fields**.
- [ ] Wizard is resumable; the baseline invitation appears after the first completed session.
- [ ] With `horse_health` off, the wizard's Health step does not render.

**Claim**
- [ ] Guest join unchanged: name → **Join with microphone** → two-way audio, no account, no gate.
- [ ] On lesson close a guest sees the teaser claim screen; **Not now** dismisses; token works 7 days.
- [ ] An unclaimed trainer can reach **no** debrief content — verify by direct URL, not just UI.
- [ ] Claim → signup → lands on that lesson's full debrief; roster shows the rider as Pending.
- [ ] A claiming coach can read the lesson they taught with **no** rider approval.
- [ ] A coach can reach **no other** rider data before approval — verify by direct URL.
- [ ] Rider approval sets scope; declining still leaves the taught lesson accessible.
- [ ] 2+ lessons in 12 hours produces the batch screen, not repeated prompts.
- [ ] **No payment check and no roster-size check anywhere in the coach path.**
      `FREE_COACH_MAX_RIDERS` is deleted from the codebase.

**Always**
- [ ] No "AI" in rendered copy. Health calm. Two voices kept in separate zones. Verified at 390px.
- [ ] Every file touched listed; every stub listed explicitly.

---

## Known conflict to raise, not silently fix

**`sessionStorage` in `/(join)/join/[code]/page.tsx`** breaks the repo's no-storage rule, but it is
load-bearing — it resumes the trainer's lesson after an iOS Safari reload or screen lock. Keep it.
Either document the exception in `VE-repo-CLAUDE-md.md` or move it to a short-lived cookie. Do not
remove it without a replacement.

---

### Cursor prompt
> Apply `brief-13-rider-first-five-and-scan-in-claim.md`, STEP A→I, then run STEP J.
> Do not rebuild the roles/connections layer or the feature-flag system — both already exist
> (`20260719000000_roles_connections_shares.sql`, `/api/connections/*`, `/profile/coach/[riderId]`,
> `src/lib/flags/*`, `20260625000000_feature_flags_and_cohorts.sql`).
> STEP A: extend the flag registry, make flag-off surfaces absent rather than "Coming soon", and
> delete the hardcoded health block on the Vector home.
> STEP B–D: delete the `ai-trainer` routes, collapse the two horse surfaces and the two
> horse-creation paths, cut onboarding to three fields, and make the setup wizard resumable with
> only horse name required to start.
> STEP E–I: add migration `20260814000000_capture_trainer_claim.sql` (trainer_id, claim_token,
> claim_expires_at, claimed_at on capture_sessions; `'capture'` as an `initiated_by` value), then
> build the claim API, the end-of-lesson teaser + claim screen, `?claim=` signup carry-through,
> auto-share of the taught lesson, rider approval for everything else, and the clinic batch screen.
> The guest join flow itself must not change. Delete `FREE_COACH_MAX_RIDERS` — no payment or
> roster-size check may exist in any coach path. Keep brand and copy rules: no "AI", health flagged
> never diagnosed, two voices separated, verify at 390px. List files touched and paste STEP J results.
