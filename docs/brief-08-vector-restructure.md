# Brief 08 — Vector section restructure ("The Loop")

**For Cursor to build** in the existing app (`Vector-Equine/`, Next.js + shadcn/ui + Supabase).
This **evolves the current `/train` section** into **Vector**, arranged as **"The Loop."** Do
**not** rebuild the app — reuse existing routes, components, data, auth, and payments; restructure
and restyle.

**Visual + intent spec:** open `vector-prototype.html` (toggle set to **The Loop**) and
`vector-ux-foundation.md`. The prototype is the target look/flow; this brief maps it onto the real
codebase.

Brand hexes: navy `#0E1729` · navy-2 `#131C31` · cream `#FCF2E6` · gold `#D1A955` · gold-bright
`#F0C967` · ink `#1A2133`. Copy rules (hard): never print "AI" in UI; the coach is **"Vector"**;
include an "alongside your trainer" line; health is flagged, never diagnosed.

**Build order:** A rename → B new IA → C route/component map → D Plan → E Live → F Debrief →
G brand pass → H progressive disclosure → I verify.

---

## The model (context)

The section does three jobs — train, health, predict — organized around **two rooms**:
**Today** (what I'm doing now) and **Horse** (Dean's timeline: health + predict + history).
**The ride is a flow, not a tab:** Start → Plan → Live → Debrief. Each completed ride feeds the
Horse timeline automatically.

---

## STEP A — Rename & label: Train → Vector

- Everywhere the UI says "Train," say **"Vector"** (nav label, section header, page `<title>`s,
  breadcrumbs, empty states).
- **Keep the `/train` route path** to avoid link churn; only the *label* changes. (Optional
  later: add a `/vector` route that redirects to `/train`. Not required now.)
- The intelligence/coach voice is "Vector." Remove every user-facing "AI" string (see STEP D).

---

## STEP B — New in-section IA ("The Loop")

Replace the current 5-item sub-nav (`train-layout-client.tsx`: Dashboard / Horses / Sessions /
Insights / AI Trainer) with the Loop model:

**In-section bottom nav (3 items):** `Today` · **`Start ride`** (center, gold) · `Horse`.
- `Today` → `/train` (home)
- `Start ride` → launches the ride flow (`/train/ride/plan`)
- `Horse` → `/train/horse` (the active horse's room)

**Today (home)** — evolve the current `train/page.tsx` dashboard into:
- Eyebrow `VECTOR`, serif greeting, **active-horse chip** (name · level, with a switcher if the
  rider has >1 horse).
- **Today's focus** hero card (movement + one gold-italic line) with a big **Start ride** button.
- Two stat tiles: **Aid consistency** (from insights data) and **Streak** (existing streak calc).
- **Horse load nudge** — one calm line ("Dean's load this week — balanced") tapping into
  `/train/horse` (Health section). Health-flag language only.
- **One "noticed" insight** — a single most-relevant pattern (from aggregated session data) →
  taps into Plan.
- **Recent ride** row (latest 1–2 sessions) → taps into the Debrief (session detail).

**Horse room** — new route `/train/horse` — one scrollable page combining, in order with ◇
dividers: **Profile** (from `horse_profiles`), **Health** (load/recovery/symmetry — flags),
**Predict** (readiness/forecast/pattern), **History** (session list for this horse). Add a horse
switcher at the top if multiple horses. This absorbs the old **Insights** page (fold its trend
data into Health/Progress here and into the Today tiles).

---

## STEP C — Map existing routes/components → new pieces

| Today (current) | Becomes | Notes |
|---|---|---|
| `train/page.tsx` (Dashboard) | **Today** home | restructure per STEP B |
| `train/horses/*` | **Horse room** + horse CRUD | keep create/edit; the room reads these |
| `train/sessions` (list) | **History** (inside Horse) + **Recent** (on Today) | keep the data; re-place the UI |
| `train/sessions/[id]` (detail) | **Debrief** | restyle to the decoded layout (STEP F) |
| `train/insights/*` | **Progress** folded into Today tiles + Horse/Health | retire the standalone tab |
| `train/ai-trainer/*` | **Plan / "Ask Vector"** | rename, strip "AI" (STEP D) |
| `components/train/*` | reuse | restyle in the brand pass (STEP G) |
| `api/train/*` | reuse as-is | no data-model change in this brief |

Retire the old 5-tab nav. Preserve all existing data and API routes.

---

## STEP D — Plan screen (rename "AI Trainer")

Route: `/train/ride/plan` (move/rename `train/ai-trainer`). This is the conversation that turns a
goal into a plan.
- Rename **everything** "AI Trainer" → **"Plan"** or **"Ask Vector."** Grep the repo for `AI`,
  `ai-trainer`, `AiTrainer`, "AI Trainer", "AI analysis" and replace user-facing copy — the string
  "AI" must not render. (Internal function/var names can stay, but not visible text or route
  labels.)
- UI per prototype: rider states the goal → Vector replies with a short read-back + a numbered
  **exercise list** + an optional arena diagram + a **Start ride** CTA + the line "Works alongside
  your trainer — bring these to your next lesson too."
- Keep the existing video-upload + analysis + chat functionality, re-housed under Plan/Ask Vector
  (it's a way to "ask about a ride"), just re-labeled and restyled. Verify no "AI" label remains.

---

## STEP E — Live Ride (new shell; scope honestly)

Route: `/train/ride/live`. Build the screen shell per the prototype (status strip, coaching-cue
banner, the six aid "sweet spot" meters, horse-response meter, "Headset view" toggle, End ride).
- **MVP reality:** real-time aid reading needs sensors. Until hardware is live, gate the aid
  meters behind a `SENSORS_CONNECTED` flag. Without sensors, Live Ride = the **comms session**
  (timer + trainer-comms indicator + "capturing this session" state) so a comms-only rider still
  gets a session that produces a Debrief. Show the aid UI only when sensor data exists.
- End ride → create a session (`session_source` = 'comms' | 'sensor' | 'hybrid', per brief-07) →
  route to Debrief.
- Do not overpromise: no fake live aid data in production; the animated meters are the prototype's
  job, not the shipped app's.

---

## STEP F — Debrief (restyle session detail)

Route: keep `/train/sessions/[id]` (or `/train/ride/debrief/[id]`). Restyle the session detail
into the decoded layout:
- **Execution score** hero (where scored) + one gold-italic line.
- **"Your ride, decoded"** — video block + timeline; decoded moments (timestamped, plain
  language) where sensor data exists; otherwise the coach/summary version.
- **Session summary** + **homework** (fields from brief-07 `session_source` additions) — this is
  what a comms-only ride delivers.
- The six **training-scale bars** (existing score fields: rhythm/relaxation/connection/impulsion/
  straightness/collection), editable.
- One **calm health line** (symmetry ✓ / gentle watch note).
- **Share** action → outward share card (defined in brief-09).
- **Save to journal** + **Ask Vector about this ride** (→ Plan).

---

## STEP G — Brand pass (kill remaining cyan in this section)

The Train components are still on the old cyan theme. Apply the brand tokens (per `brand-tokens.md`
/ brief-02 mapping) across `components/train/*` and all `train/*` pages: `cyan-*` → `gold`,
`cyan-300` → `gold-bright`; kill glows/gradients; navy surfaces, flat gold accents, serif
headlines, spaced-caps labels. After: `grep -rnE "(cyan|sky|teal|blue)-[0-9]" src/app/train src/components/train` → empty.

---

## STEP H — Progressive disclosure (the anti-overwhelm rule)

- Brand-new rider (no horse yet): Today shows only a **"Create your horse"** prompt + a disabled
  Start. No empty tiles, no empty charts.
- No sessions yet: hide Progress tiles and the Horse timeline; show a single invitation instead.
- Reveal Health/Predict in the Horse room only once there's enough data; until then show a short
  "these unlock as you ride" note, not an empty module.
- One primary action per screen; everything else secondary.

---

## STEP I — Verify
- [ ] Section reads "Vector" everywhere; the string "AI" renders nowhere; "alongside your trainer"
      present; health flagged not diagnosed.
- [ ] In-section nav = Today · Start ride · Horse; old 5-tab nav gone; Insights folded in.
- [ ] Ride flow works: Start → Plan → Live → Debrief; a comms-only ride (no sensors) still
      produces a Debrief with summary + homework.
- [ ] Horse room shows Profile/Health/Predict/History stacked; horse switcher when >1 horse.
- [ ] `grep -rnE "(cyan|sky|teal|blue)-[0-9]" src/app/train src/components/train` is empty.
- [ ] New-user and no-data states show invitations, not empty modules.
- [ ] Existing data + `api/train/*` still work. List every file touched.

---

### Cursor prompt
> Apply `brief-08-vector-restructure.md`, STEP A→H, then STEP I. Open `vector-prototype.html`
> (The Loop) and `vector-ux-foundation.md` as the visual/flow target. Evolve the existing `/train`
> section into "Vector / The Loop" — relabel Train→Vector (keep the /train route), replace the
> 5-tab sub-nav with Today · Start ride · Horse, fold Insights into Today+Horse, rename AI Trainer
> to Plan/Ask Vector and remove every visible "AI" string, restyle session detail into the Debrief,
> and do the cyan→gold brand pass across train pages/components. Gate the live aid meters behind a
> SENSORS_CONNECTED flag; a comms-only ride must still produce a Debrief. Preserve data, APIs, and
> plumbing. Then run the STEP I checklist and the two greps, and list files touched.
