# Vector Equine — Repo Rules

Read this before writing any code in this repo. These are standing constraints, not
suggestions. They apply to every task unless a brief explicitly overrides them.

---

## What this product is

Vector Equine reads a rider's aids — pressure, timing, release — through biosensors on horse
and rider, and coaches in real time through AR wearables and the app. The section formerly
called "Train" is now called **Vector**. It does three jobs: training in the moment, health
over time, and prediction.

The organizing idea for the whole app: **the ride is a moment, the horse is a timeline.**
Anything that happens *today* belongs to the ride. Anything that accrues *over time* belongs to
the horse.

---

## Stack

- Next.js (App Router) + React. TypeScript.
- Web-first, but **every screen is designed at 390 × 844 and must be correct at phone width
  before desktop.** If a change looks right on a laptop and wrong on a phone, it's wrong.
- Match the styling approach already in the file you're editing. Do not introduce a second
  styling system (no adding Tailwind to a CSS-modules file, or vice versa).
- No `localStorage` or `sessionStorage`.

---

## Language rules — these are absolute

1. **The string "AI" must never appear in rendered copy.** Not in a label, not in a tooltip,
   not in a placeholder. The intelligence is called **Vector**, or it isn't named. Frame
   everything as sensors, patterns, "reads the aids," "decoded," "learns your horse."
2. **Vector assists the trainer, never replaces them.** Where relevant: "Works alongside your
   trainer — bring this to your next lesson."
3. **Health is flagged, never diagnosed.** Load, recovery, symmetry get calm watch-language:
   "Symmetry looked even today ✓" / "Worth keeping an eye on — mention it to your vet."
   Never "injury," "lameness," "diagnosis," "prescribe," "abnormal."
4. **The word "today" is banned from the Vector home screen.** The date line carries it and the
   nav tab is RIDE. This was a deliberate fix for the word appearing four times.
5. **The app never grades the rider.** Judges already do that. Banned as rendered copy:
   `score`, `grade`, `mark` (as a noun), `verdict`, `execution`, `judged`. Where a number
   belongs to a ride it is **the rider's own feel**, supplied by them — see below.
6. **Tone:** short declarative lines. Rider-native, not marketer. One gold-italic phrase per
   screen, maximum. Never over-explain — trust the audience.

If a task's copy would break one of these, stop and flag it rather than shipping it.

---

## The two voices

Every screen that mixes coaching with data keeps these apart. Get this wrong and the product
overclaims for what the models can currently support.

**The trainer coaches.** Second person, plain language, imperative. Quoting a human. This is the
voice that tells a rider what to do.

> *"Don't make the circle smaller. Make the canter smaller."*

**The sensors measure.** Third person, numeric, observational. **States facts, draws no
conclusions.** No "you should," no cause, no diagnosis.

> *"0.4s · Right seat released after the outside rein, in 3 of 5 transitions."*

Keep them in separate zones, never interleaved. As the models mature the measurement voice earns
more interpretation; **the coaching voice never changes.** If a measurement row ever says "you
should," it has crossed into a claim we can't back.

### In a conversational surface: Vector attributes

When Vector answers a rider directly, the two voices live in one paragraph — so the rule becomes
attribution. **Vector never issues coaching in its own name.**

- Prescriptive content **quotes the trainer by name** or **names an exercise from the library**.
  *"Emma called it at the time — the circle got small before it got collected."*
- Numeric content is a **measurement, stated flat**, with no conclusion attached.
- Comparison across rides is factual: *"It went the same way on Jul 21."*
- When it doesn't know, it says so in one line and doesn't apologise twice.

Without this the conversation quietly becomes a coach that outranks the trainer — which breaks
the brand promise and the product's defensibility at the same time.

---

## Voice

Talking to Vector is the founding interaction, and the app should train the habit before the
headset ships. Where a conversational surface exists:

- **Press and hold, never tap-to-toggle.** It matches the headset gesture and can't record a
  whole barn conversation by accident. Send on release, including release outside the control.
- **Press-and-hold everywhere, except inside a live session, where `Hey Vector` is armed
  on-device from session start to session end.** A wake word opens no new capture surface —
  both sides already record continuously by design.
- **Answers are spoken as well as shown.** Listening without speaking back is a voice-to-text
  search box, and it teaches the rider nothing.
- **Typing is always one tap away, never buried.** A lot of use happens in a quiet barn aisle
  where nobody wants to talk to their phone.
- **Ask for the microphone on first hold**, never on page load. Denied is one calm line and the
  typed composer — no modal, no second prompt.
- No spinners. No bubbles, avatars, or bouncing-dot typing indicators. It's a room, not a
  messenger.

---

## Numbers that belong to the rider

Any per-ride number is **asked, never computed.** The rider answers *"How did it feel?"* on a
**1–5** scale; Vector stores it and shows it back. Never display a placeholder, a zero, or a dash
where an unanswered feel would go — render the ask instead, or nothing.

Only the two ends of a scale get labels (`1 · a fight`, `5 · effortless`). Riders calibrate
their own middle. Historic rides answered on 1–10 keep `scale: 10` and display the number the
rider gave — **never rescale a stored value.** `feel_scale` is written in the same transaction
as `value`, or not at all.

---

## Brand tokens

Define once, use everywhere. Never hard-code a hex outside this block.

```css
:root{
  --navy:#0E1729;        /* app background */
  --navy-2:#131C31;      /* raised surface */
  --navy-3:#1A2440;      /* inset panels, empty meter tracks */
  --cream:#FCF2E6;       /* primary text on navy; background of reading zones */
  --cream-dim:#B8B0A4;   /* secondary text, labels */
  --gold:#D1A955;        /* accents, borders, active state, key numbers */
  --gold-bright:#F0C967; /* rare highlight only — live pulse, one hero number */
  --ink:#1A2133;         /* text on cream */
  --good:#7FB08A;        /* muted sage — positive flag, "in the sweet spot" */
  --watch:#C98A5A;       /* muted amber — "watch this". NOT red. */
  --line:rgba(209,169,85,.18); /* hairline gold divider */
}
```

Inside a cream reading zone the palette shifts: labels `#8A6D2F`, body `#3A4152`,
links and numbers `#9A7526`, ticks and diamonds `#C9A24A`, rules `rgba(26,33,51,.14)`.

### Rules for using them

- **Gold is a scalpel, not a highlighter.** Flat gold only — no glows, no neon, no drop shadows
  on gold, ever.
- **No cyan. No red.** Warnings are `--watch` amber.
- Long body copy is cream on navy or ink on cream. Gold is for accents, labels, and numbers —
  never for paragraphs.
- Red/green semantic pairs are `--watch` / `--good`. Nothing else.

---

## Type

- Headlines, screen titles, big numbers, timers: `Georgia, "Times New Roman", serif`.
- Labels, eyebrows, nav, metric captions: system sans, uppercase, `letter-spacing:.28em`,
  ~10px, in `--cream-dim` or `--gold`.
- Body: system sans, comfortable line-height (1.65–1.75).
- Emotional weight: serif italic in `--gold`. One per screen.
- **Do not add a webfont.** System serif + system sans only.

---

## The atmosphere layers

Every dark screen gets these three, absolutely positioned behind the content. This is not
decoration — flat navy reads as a screenshot, and grain is most of the reason it doesn't.

```css
.atmos{ position:absolute; inset:0; z-index:1; pointer-events:none;
  background:
    radial-gradient(120% 62% at 50% 6%, rgba(209,169,85,.13) 0%, rgba(209,169,85,.04) 34%, rgba(209,169,85,0) 62%),
    linear-gradient(180deg,#121C33 0%,#0E1729 46%,#0A1122 100%); }

.vig{ position:absolute; inset:0; z-index:2; pointer-events:none;
  box-shadow:inset 0 0 160px 40px rgba(5,8,15,.75); }

.grain{ position:absolute; inset:0; z-index:3; pointer-events:none;
  opacity:.055; mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>"); }
```

Use them through a single shared wrapper component. Do not copy-paste these into screens.

---

## Layout language

- **No bordered cards.** Separation is hairline rules (`--line`) and a centered gold diamond
  `◇`. Boxes-inside-boxes is the specific thing the home-screen redesign removed.
- **No modals** — with one named exception: the post-ride feel rating blocking sheet
  (`vector_feel_prompt`). It is deliberate because this number is load-bearing and a passive
  ask does not get answered. **It is not precedent.** No other screen gets a blocking sheet.
- Content is **left-aligned.** Centering is reserved — when something is centered, that means
  it's the primary action.
- Generous navy breathing room. One primary action per screen; everything else is secondary or
  a text link.
- **Progressive disclosure.** Never render an empty module — hide it until there's data, or
  show a single invitation instead. The app grows with the rider.
- Navy = doing. Cream = reading. Reading zones may use cream backgrounds; **the ride itself
  stays navy always** (an arena at noon needs dark).
- Transitions between cream and navy are **hard cuts** with a 1px `rgba(209,169,85,.28)`
  hairline at the seam. No gradient fades.

---

## Accessibility

- Tap targets ≥ 44px.
- Contrast must hold in both the navy and cream zones.
- Motion is calm and slow — meters breathe, cues cross-fade. Nothing flashes or bounces.

---

## Working style

- Follow the brief. When a brief in the project docs covers the screen you're touching, it
  wins over your instincts about layout.
- Prefer evolving existing components over rebuilding. The app's auth, payments, and social
  plumbing works — don't disturb it.
- Verify at 390px width before calling a task done, and say so.
- If you stub something, list it explicitly at the end. Don't let a stub pass as finished.
