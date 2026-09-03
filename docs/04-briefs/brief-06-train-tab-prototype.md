# Brief 06 — Train Tab Prototype (investor-facing clickable mockup)

**For Cursor to build.** This is a **standalone, self-contained clickable HTML prototype** —
a demo artifact for investors and clients. It is **NOT** wired into the Next.js app, does not
touch the repo's `src/`, and uses no backend, Supabase, or real data. Build it as one HTML file
you can open in a browser and click through, or drop into a screen-share during a pitch.

The goal: show what the **Train experience becomes** once the sensors and coaching layer are
live — not the current manual journal. This is the vision on a phone screen.

Brand hexes: navy `#0E1729` · cream `#FCF2E6` · gold `#D1A955` · gold-bright `#F0C967` · ink `#1A2133`.

---

## 0. The concept (read this first)

Today's Train tab is a manual training journal + video uploader — five utility tabs (Dashboard,
Horses, Sessions, Insights, AI Trainer). Useful, but it looks like any fitness app and shows
none of what makes Vector Equine unlike anything else.

This prototype reimagines Train around the real loop:

> **Plan the ride → Ride it (aids read live) → See it decoded → Track it over time.**

The rider wears sensors; Vector reads pressure, timing, and release; the headset cues in the
moment; and afterward the ride is *decoded* into plain language and a score. The whole thing is
built to feel like a tool that rides *with* you — not a camera, not a replacement for your
trainer.

**Five phone screens, one continuous demo:**

1. **Hub** — the Train home. Today's focus, active horse, one tap to start.
2. **Plan** — tell Vector the goal, get exercises + a visual. (The conversation entry point.)
3. **Live Ride** — the hero. Real-time aid "sweet spot" bars, a spoken cue, the horse's
   response — plus an in-app preview of what the headset shows.
4. **Debrief** — the ride decoded: the movement scored, each aid's timing/release read back,
   video synced to the aid timeline.
5. **Progress** — the rider's aids improving over time and the horse's training load / recovery.

---

## 1. Non-negotiable language rules (apply to ALL copy in the prototype)

These come from the Vector Equine brand decisions. Cursor: do not deviate.

1. **Never lead with "AI" in rider-facing copy.** Frame everything as *sensors, data, patterns,
   "learns your horse's patterns," "reads the aids," "decoded."* The word "AI" does not appear on
   any screen. (The intelligence is implied, never announced.) → So **do not** label anything
   "AI Trainer." The coaching voice is simply **Vector** (or "your coach").
2. **Never position Vector as replacing the trainer.** Reinforce "You ride, Vector assists."
   Include at least one line like *"Works alongside your trainer — bring this to your next lesson."*
3. **Health is flagged, never diagnosed.** Any soundness/load signal uses calm, watch-language:
   *"Symmetry looked even today ✓"* or *"Worth keeping an eye on — mention it to your vet."*
   Never "injury," "diagnosis," "lameness," "prescribe."
4. **Tone:** confident, spare, rider-native. Short declarative lines. One gold-italic emotional
   phrase per screen, max. Never sound like a tech startup — sound like a rider who built this.

---

## 2. Global spec

### 2.1 Brand tokens (put in a `:root` block)

```css
:root{
  --navy:#0E1729;        /* app background */
  --navy-2:#131C31;      /* raised surface / cards */
  --navy-3:#1A2440;      /* card hover / inset panels */
  --cream:#FCF2E6;       /* primary text on navy */
  --cream-dim:#B8B0A4;   /* secondary text / labels */
  --gold:#D1A955;        /* accents, borders, active state, key numbers */
  --gold-bright:#F0C967; /* rare highlight only (live pulse, one hero number) */
  --ink:#1A2133;
  --good:#7FB08A;        /* muted sage — "in the sweet spot" / positive flag */
  --watch:#C98A5A;       /* muted amber — "watch this" flag (NOT red) */
  --line:rgba(209,169,85,.18); /* hairline gold divider */
}
```

Rules: **gold is a scalpel, not a highlighter.** Flat gold — no glows, no neon, no drop-shadows
on gold. No cyan anywhere. Backgrounds are navy; cards are `--navy-2`; the app is cinematic and
dark throughout (this is "the tool," it stays dark).

### 2.2 Type

- Headlines / screen titles / big numbers: **serif** — `Georgia, "Times New Roman", serif`.
- Nav labels, eyebrows, metric captions: **sans**, uppercase, `letter-spacing:.28em`, ~11px,
  color `--cream-dim` or `--gold`.
- Body: system sans, comfortable line-height.
- One **gold italic** phrase per screen for emotional weight (serif italic, `--gold`).

### 2.3 The phone frame

- Render a single centered **phone frame**: 390 × 844, `border-radius:44px`, thin bezel, subtle
  status bar (time `9:41`, signal/wifi/battery glyphs), and a home-indicator bar at the bottom.
- The app content scrolls inside the frame; the frame itself is fixed.
- On a desktop screen, center the phone on a very dark backdrop (`#080D18`) with a small
  Vector wordmark + one line of context above it (see §4.6). This is what fills the browser
  when you present.

### 2.4 In-app navigation

- A **bottom tab bar inside the phone** with 5 items using spaced-caps micro-labels + a simple
  line icon each: **HUB · PLAN · RIDE · DEBRIEF · PROGRESS**. Active tab = gold icon+label; a thin
  gold top-border on the active item. (In the real app these live under the main Train tab; for
  the prototype this bottom bar is the fastest way to click between the five screens.)
- Every screen is reachable from the tab bar, AND the primary CTAs advance the story (Hub →
  Plan → Ride → Debrief) so the demo flows without touching the tab bar. Support both.
- Screen switching is instant (show/hide sections via JS; no page reloads).

### 2.5 The demo persona + data (hard-code this, it recurs across screens)

- **Rider:** first-name only in greeting ("Welcome back, Rhen"). Keep neutral so it demos for anyone.
- **Horse:** **Dean** — 18 yo Hanoverian gelding, schooling **PSG**, working toward the year's
  goal. Bay. Use a tasteful placeholder silhouette/monogram "D" in a gold ring (no stock photos).
- **Focus movement:** **canter pirouettes** — "he doesn't sit enough and spins out."
- **Exercises Vector prescribes** (use these exact names — they're real Vector methodology):
  *spiral accordion*, *quarter pirouettes on a square*, *triangle to X*, plus *collect on a
  10 m circle*.
- Numbers should feel real, not round: Overall Feel 7.4, aid consistency 82%, half-pirouette
  execution 6.5, load "balanced," recovery trending up.

---

## 3. Screen-by-screen spec

> For each screen: layout top-to-bottom, the copy, and the interactions. Keep spacing generous —
> lots of navy breathing room. Section breaks use a small centered gold diamond `◇`.

### 3.1 HUB (Train home)

**Purpose:** orient in two seconds, one tap to today's ride.

- **Eyebrow:** `TRAIN` (spaced caps, gold). Below it, serif greeting: "Welcome back, Rhen."
- **Active-horse chip** (top-right or under greeting): gold-ringed "D" monogram + "Dean · PSG",
  a small chevron implying a horse switcher (non-functional, just show it).
- **Hero card — Today's focus:** `--navy-2`, gold hairline border.
  - Small caps label `TODAY'S FOCUS`.
  - Serif line: "Canter pirouettes."
  - One gold-italic subline: *"He sits, or he spins. Let's find the seat."*
  - Two buttons: **Plan today's ride** (solid gold, navy text → goes to PLAN) and **Start ride**
    (gold outline → goes to LIVE RIDE).
- **Two stat tiles side by side:**
  - *Consistency* — big serif "82%" gold, caption "AID CONSISTENCY · 30 DAYS", tiny up-trend.
  - *Streak* — big serif "6", caption "DAY STREAK".
- **Dean's load snapshot** (health tie-in, framed carefully): a slim card with a horizontal
  segmented bar (recovery → balanced → heavy). Marker sits in "balanced." Caption:
  "Dean's training load this week — **balanced.**" Sub-line in `--cream-dim`:
  "Recovery trending up. A good week to ask a little more." No medical words.
- **One "noticed" insight** (the payoff of the sensors): small card, gold left-tick —
  "Your right seatbone released a beat late in 3 of your last 5 canter transitions." + a tiny
  text link "Work on it →" (goes to PLAN).
- **Recent rides** (2 rows): date · movement · Feel x/10 · a small "decoded" tag → tap goes to DEBRIEF.

### 3.2 PLAN (talk to Vector)

**Purpose:** the conversation that turns a goal into a plan. Chat-style, but premium — not a
generic chatbot. This is where "you talk to your coach" lives.

- Header: eyebrow `PLAN` + serif "Today's ride."
- **Rider bubble** (right-aligned, `--navy-3`, a small mic glyph to imply it was spoken):
  > "I'm with Dean. We're chasing the PSG this year and the canter pirouettes are falling apart —
  > he doesn't sit and he spins out. Give me exercises to build it from the ground up, then score
  > my half-pirouettes."
- **Vector response** (left-aligned, `--navy-2`, small gold ◇ avatar — NOT a robot icon):
  - A one-line read-back: "Got it — sit and carry, not spin. Build it in three steps."
  - **An exercise list** as clean numbered cards (each: name in cream, one-line "why" in dim):
    1. **Collect on a 10 m circle** — get the canter carrying before you ask it to turn.
    2. **Spiral accordion** — in and out to teach him to bring the hind leg under.
    3. **Quarter pirouettes on a square** — one quarter per corner; reward the sit, rebuild the canter.
    4. **Triangle to X** — then ask for the half-pirouette and I'll score it.
  - **Visual card:** a simple arena diagram (SVG) illustrating one exercise — e.g. a 20×60
    dressage arena outline (gold hairlines on navy) with a small square + quarter-turn arrows for
    "quarter pirouettes on a square." Keep it schematic and elegant.
  - Reassurance line (`--cream-dim`, small): "Works alongside your trainer — bring these to your
    next lesson too."
- **Sticky bottom actions:** **Set as today's plan** (gold outline) + **Start ride** (solid gold →
  LIVE RIDE). Plus a faux voice-input bar ("Hold to talk to Vector" with a mic glyph — visual only).

### 3.3 LIVE RIDE — the hero screen

**Purpose:** the wow. Everything animates so it reads as *live*. This is the screen investors
remember.

Layout, top to bottom:

- **Top status strip:** left — gold-bright pulsing dot + `LIVE`; center — "Collected canter";
  right — a running timer counting up (e.g. `04:12`, tick it live via JS). Under it, small:
  "Dean · Half-pirouette right."
- **The coaching cue banner** (the spoken feedback made visible): a wide `--navy-2` card with a
  small speaker glyph and a large-ish cream line that **changes every few seconds** on a loop, e.g.:
  - "Sit more on your right seatbone."
  - "Lengthen your left leg from the hip."
  - "Soften the right rein — let him turn."
  - "There — hold that. That's the sit."  (this last one flashes `--good`)
  Fade each cue in/out. This is the core demo beat: *the coach is talking to you in real time.*
- **The sweet-spot aid panel — THE centerpiece.** Six vertical meters in a row, one per aid:
  **L SEAT · R SEAT · L LEG · R LEG · L REIN · R REIN.** For each meter:
  - A vertical track (`--navy-3`).
  - A **gold "sweet spot" band** — a highlighted zone partway up the track (the target pressure).
  - A **live fill** that animates up/down (via JS/requestAnimationFrame, gentle random-walk toward
    a target) representing current pressure.
  - When the fill sits **inside** the band, the meter glows faintly `--good` and shows a tiny ✓ /
    a "release" tick; when it's over/under, it's neutral gold; keep one meter (R SEAT) sitting
    *below* the band to match the "sit more on your right seatbone" cue — so the visual and the
    words agree.
  - Under each meter: the aid label (spaced caps, tiny) + a small **timing/release dot** that
    pulses on the beat (implies rhythm/release timing).
  - Caption under the whole panel: "Pressure · timing · release — read live." (small, dim)
- **Horse-response strip:** a slim horizontal meter labeled "DEAN'S RESPONSE" moving between
  "resisting → listening → sitting," parked near "sitting" with a `--good` tick. One line:
  "He's answering the outside rein."
- **AR preview toggle:** a pill button **"Headset view"**. Tapping it overlays a **minimal
  version** of the same info as it would appear in the Ray-Bans — dark, edge-anchored, only the
  current cue + one or two sweet-spot bars floating in the periphery, lots of empty center (so it
  reads as a heads-up overlay you'd see over the real arena, not a full UI). A small caption:
  "What you see through the glasses." Toggle back to the full phone view. (This stays inside the
  phone — it's an in-app preview, not a separate device render.)
- **End ride** button (gold outline, bottom) → DEBRIEF.

Motion notes: everything subtle and smooth. No frantic fl", no flashing. The aid meters breathe;
the cue cross-fades; the timer ticks; the response meter drifts. It should feel calm and precise —
"technical precision meets equestrian tradition."

### 3.4 DEBRIEF — the ride decoded

**Purpose:** the "conversation decoded" — sensor data turned into something a rider reads in
five seconds, plus the score. This is the proof the product *works*.

- Header: eyebrow `DEBRIEF` + serif "Half-pirouette, right." Sub: "Dean · today · 41 min ride."
- **Score hero:** big serif **6.5** in gold-bright, next to it small: "EXECUTION" and a caption
  "suggested range 6.0–7.0." One gold-italic line: *"Closer than it felt."*
- **"Your aids, decoded"** section (the headline feature):
  - A **video/timeline block:** a placeholder video frame (dark, a play triangle, a still of an
    arena — use a simple SVG/gradient, no real footage) with a **scrubber timeline** underneath.
    On the timeline, plot **3–4 gold/amber markers** at moments of interest.
  - Below the timeline, **2–3 decoded moments** as cards, each tied to a marker:
    - `0:04 · watch` — "Right seatbone released 0.4s late on entry — that's the drift out." (amber tick)
    - `0:11 · good` — "Left leg held steady through the turn — that's the sit." (sage tick)
    - `0:19 · watch` — "Right rein got heavy — he lost the jump for a stride." (amber tick)
  - The point: plain language, timestamped, actionable — no jargon dump.
- **Aid effectiveness grid:** the six aids again, each with a tiny bar + a word: *timing*,
  *release*, *consistency*. E.g. "R Seat — release: late · R Rein — pressure: heavy · L Leg —
  steady ✓." Keep it scannable.
- **Training-scale scores** (bridges to the existing journal — shows continuity with today's app):
  the six marks — Rhythm, Relaxation, Connection, Impulsion, Straightness, Collection — shown as
  slim gold bars with values (e.g. Collection 6, Straightness 6, Rhythm 7…). Caption: "Suggested
  from your ride — adjust anytime." (implies editable; static is fine.)
- **Health flag (calm):** one line with a `--good` tick — "Trunk symmetry looked even today. ✓"
  (Show the *watch* variant styling exists too, but default to the reassuring one.)
- **Bottom actions:** **Save to journal** (gold outline) + **Ask Vector about this ride** (text
  link → PLAN).

### 3.5 PROGRESS — over time

**Purpose:** the retention story — you can *see* yourself and your horse getting better.

- Header: eyebrow `PROGRESS`. A **segmented toggle: "My riding" | "Dean".** (Both work; switch
  the content below.)
- **My riding view:**
  - Hero metric: "AID CONSISTENCY" big serif "82%" gold + "▲ 9 pts in 30 days" small `--good`.
  - A **line/area trend** (simple inline SVG) of consistency over ~8 weeks, gently rising, gold line.
  - The six training-scale categories as horizontal bars with 30-day change chips (+/-).
  - One insight card: "Your seat timing is the most improved — release is landing on the beat
    more often." (positive, specific.)
- **Dean view:**
  - **Training load** over weeks — a small column chart (acute vs chronic feel), with the current
    week marked "balanced." Caption: "Load and recovery — so you know when to push and when to ease."
  - **Recovery trend** — a line trending up, "recovering faster than a month ago."
  - **Symmetry trend** — flat/even line with a `--good` tick, "even and steady." + the calm
    watch-language note: "If this ever drifts, we'll flag it — worth a mention to your vet."
  - Session count + "next: build the full pirouette."

---

## 4. Build instructions

### 4.1 Structure
- **One file:** `train-prototype.html`, fully self-contained. Inline `<style>` and `<script>`.
  No build step, no npm, no external network calls. It must open by double-click.
- Fonts: system serif (Georgia) + system sans only — **do not** pull a webfont CDN (keep it
  offline-safe). Spaced caps via `letter-spacing`.
- No images/photos — everything is CSS, SVG, and type. Horse = monogram; arena/diagrams = SVG;
  video = styled placeholder block.

### 4.2 How screens work
- Five `<section>`s, one per screen, absolutely positioned inside the phone content area; JS
  shows one at a time. Bottom tab bar + CTA buttons call `goTo('ride')` etc.
- Keep transitions to a quick cross-fade (150–200ms). Instant is fine.

### 4.3 The "live" feel (JS)
- Live Ride: a `requestAnimationFrame` loop nudges each aid meter's fill toward a per-meter
  target with small easing + occasional target changes (random-walk within bounds). R SEAT stays
  biased below its band. Timer increments each second. Cue banner cross-fades through the cue
  array on a ~3.5s interval. Response meter drifts near "sitting."
- Everything must **pause/stop cleanly** when you leave the Ride screen (don't leak intervals).
- **No `localStorage`/`sessionStorage`** anywhere — state in JS variables only.

### 4.4 Responsiveness
- Design at 390×844 inside the frame. It only needs to look right at phone size inside the frame;
  the frame is centered on desktop. Content scrolls vertically within the frame where needed
  (Hub, Plan, Debrief, Progress will scroll; Live Ride should fit without scrolling if possible).

### 4.5 Accessibility / polish
- Sufficient contrast (cream on navy is fine; don't put gold text on navy for long body copy —
  gold is for accents/numbers, cream for reading).
- Tap targets ≥ 44px. Buttons have clear hover/active states (subtle, no glow).

### 4.6 Desktop chrome (around the phone)
- Backdrop `#080D18`. Above the phone: small gold Vector wordmark/◇ and one spaced-caps line:
  `TRAIN — PROTOTYPE`. Below the phone: a faint one-liner, "You ride. Vector assists." Nothing else.

---

## 5. Acceptance criteria

- [ ] Opens as a single HTML file, no console errors, no network requests.
- [ ] All five screens reachable via the bottom tab bar **and** via the CTA story-flow
      (Hub → Plan → Ride → Debrief).
- [ ] Live Ride animates: six aid meters move, sweet-spot bands visible, R SEAT reads low to
      match the "sit more on your right seatbone" cue, cue banner cycles, timer counts, response
      meter drifts. Leaving the screen stops the loops.
- [ ] "Headset view" toggle shows a minimal AR-style overlay and toggles back.
- [ ] Debrief shows the 6.5 score, a timeline with markers, ≥3 decoded moments, the six
      training-scale bars, and a calm symmetry flag.
- [ ] Progress toggles between "My riding" and "Dean" with a rising consistency trend and Dean's
      load/recovery/symmetry.
- [ ] Brand: navy/cream/gold only. No cyan. No glows on gold. Serif headlines, spaced-caps labels,
      one gold-italic phrase per screen.
- [ ] Copy obeys §1: the word "AI" appears nowhere on screen; at least one "alongside your
      trainer" line; health is flagged, never diagnosed.

---

## 6. Cursor prompt (paste this)

> Build `train-prototype.html` per `brief-06-train-tab-prototype.md`. One self-contained file:
> inline CSS + JS, system fonts only, no external requests, no localStorage. Render a centered
> 390×844 phone frame on a dark backdrop with five clickable screens — Hub, Plan, Live Ride,
> Debrief, Progress — navigable via a bottom tab bar and via the CTA flow. Use the brand tokens in
> §2.1 (navy/cream/gold, flat gold, no cyan, no glows), serif headlines, spaced-caps labels, one
> gold-italic phrase per screen. Follow the language rules in §1 exactly: never print the word
> "AI," include an "alongside your trainer" line, flag health without diagnosing. Make Live Ride
> feel live (animated aid sweet-spot meters, cycling coaching cue, running timer, drifting
> response meter; stop all loops on screen exit) and include a "Headset view" AR-overlay toggle.
> Hard-code the Dean / canter-pirouette persona and the exact exercise names in §2.5. When done,
> confirm every box in §5 is met and list anything you stubbed.

---

*Companion to brief-02 (dark Train restyle). This prototype is the aspirational north star for
the Train tab — build it standalone first; production wiring comes later.*
