# Brief 14 — Build plan (corrected)

**Replaces the phased plan Cursor generated 2026-08-14.** That plan is a good inventory and a bad
build order. This one keeps its correct calls, front-loads what can invalidate the design, breaks
the bundles into real work, and adds the constraints a feature list structurally can't hold.

Source of truth stays `docs/brief-14-vector-in-the-session.md`. Where this document and the brief
disagree, the brief wins.

> **Cursor's 2026-08-14 revision of this plan is good and supersedes the phase list below.** It
> carries the absences, the P0 resolutions, the kill switch, the arena gate on Phase 4, 5b as a
> parallel founder track, and the escape hatch. **The six additions in the next section are what
> it's still missing — paste them in.**

---

## Two more, after the six landed (2026-08-14, second pass)

**7 · Ask the trainer twice, not once.** As written, the ship gate sits at P7 — after everything is
built. If two trainers say no there, you've built the whole feature to find out. **Add an early
trainer session after Phases 2–4**, before called turns exist: Vector opens, closes, stays silent.
*Did any of that get in your way?* That catches the social failures — an awkward capture notice, a
close that interrupts, a rating that irritates her rider — while they're still cheap to fix. Same
trainers, same question, twice.

**8 · Take Phase 5b off the critical path.** It's the only dependency in the plan with no bounded
completion date: a screened name list, plus a licensing position, two of which sit with counsel.
**Declare level 3 a follow-on release.** v1 ships levels 1 and 4 — the trainer's own method, and
general when there's nothing on record. New riders get honest marked-general answers until the
corpus lands, and level 3 becomes the first upgrade. 5b then runs at counsel's pace instead of
blocking the release.

---

## Six additions to Cursor's revised plan

### 1 · The gate nobody wrote: would the trainer run it again?

Every gate in the plan is a technical assertion — VAD works, the query returns zero rows, the sheet
can't be dismissed. **None of them asks whether a trainer would allow this in her lesson twice.**

`VE-MVP1-blueprint` M1 already set that bar for the comms hub: *a trainer runs a real lesson on it
and prefers it to what she uses now — a must-not-be-worse test, and it is unforgiving.* Brief 14
puts a **third voice into that same paid lesson.** The bar doesn't get easier; it gets harder.

**Add a gate before `vector_in_session` moves off `internal`:** two trainers, two real paid lessons
each, Vector live. Afterwards, one question — *would you run your next lesson with this on?* Two
noes and the feature stays internal regardless of how many checkboxes are green.

This is also the missing answer to *who moves the flag to `ga`, on what evidence.*

### 2 · A latency gate, or the feature fails silently

`2.5s / 4s` is listed as work, not as a gate. That's the plan's most dangerous omission, because
here is a state that passes **every** existing gate: wake word fires, retrieval works, attribution
is clean, VAD behaves — and time-to-first-word sits at 3.6s, so Vector almost never speaks and
everything quietly files to a screen the rider can't read from a horse. The feature is broken and
nothing catches it.

**Gate: measured p50 and p95 time-to-first-spoken-word over 30 real turns, on arena network
conditions.** If p50 is over 2.5s, the design needs revisiting before ship — not the threshold.

### 3 · The addressing rule needs a rate, not a scripted pass

Phase 6's gate is one staged scenario. One scripted pass says nothing about how often Vector
interjects into natural trainer-rider conversation over forty-five minutes — which is the same
class of risk as wake-word false accepts, and deserves the same treatment.

**Gate: unwanted interjections per 45 minutes of real lesson audio**, counted the way P1 counts
false accepts. Target zero; anything above it re-opens the addressing rule.

### 4 · Split the flag

`vector_in_session` currently gates everything. But the blocking rating is a **rider-facing
behaviour change that has nothing to do with a live session** — it fires on app open, days later,
and it can't be dismissed. You will plausibly want bookends on and the blocking sheet off, or the
reverse, without shipping a deploy.

**Two flags:** `vector_in_session` (open, close, called turns) and `vector_feel_prompt` (the
blocking sheet). Cheap now, expensive to retrofit the first time the sheet annoys someone.

### 5 · The escape-hatch release contradicts itself

If P1 comes back no-go and Phases 2–4 ship alone, **the session strip still reads
`◇ SAY "HEY VECTOR"`** — advertising a gesture that does nothing. The open also implies a Vector
that can be called.

**Spec the no-wake variant now**, while it's cheap: no strip hint, and confirm the open and close
copy still read honestly when Vector cannot be summoned. Otherwise the fallback release ships a
visible lie.

### 6 · Stamp `feel_scale` at answer time, not row creation

`value nullable` + `feel_scale 5|10` on the same row means an unanswered feel carries a scale it was
never answered on. Harmless today, wrong the next time the scale changes, and it quietly recreates
the "a number that looks like data but isn't" problem P0-3 exists to clean up.

**`feel_scale` is written in the same transaction as `value`, or not at all.**

---

## What Cursor got right — keep these

- **Feel rating first.** Lowest risk, real value, attaches to an event that already exists.
- **It found a live bug:** `overall_feel: 5` hardcoded in
  `src/app/api/capture/sessions/[id]/end/route.ts`. That's a genuine discovery and it's worse than
  a line item — see P0-3.
- Flag-gating behind `vector_in_session`, the docs phase, and the explicitly-not list.
- `capture-room.tsx` as the hook site, and reusing `src/lib/ask/tts.ts` for the voice.

---

## The constraints that are absences

**Half of brief 14 is things that must not exist.** They can't live only in the §9 checklist —
by then they're built. Cursor: treat each as a standing constraint for every phase.

| Must not exist | Where it would sneak in |
|---|---|
| Per-participant audio routing | The earcon. It is a **local sound on the asker's own device**, not a routed track. Nothing in this feature addresses one participant over the wire. |
| A second session table | Any migration that invents a session row instead of hanging off what's already there. |
| A field for an inference about the horse | `VectorTurn.groundedReason` cites the record. There is deliberately no sibling field for a judgment about the animal. Don't add one "for later." |
| A modal anywhere but the rating | Any sheet, dialog, or overlay added for convenience during this build. |
| A truncated exercise | Any character cap, `slice()`, "read more," or "the rest is on your screen" in the exercise path. |
| An exercise-library table | Any migration that "just adds a bit of structure" during Phase 5. v1 grounds on free text. |
| A trainer's name with no source record behind it | Any generated reply attributing to a real coach on nothing. |
| A downstream corpus filter | See P3-2. `excludedFromCorpus` is not a flag consumers check. |

---

## P0 — Resolved 2026-08-14

Cursor answered all three from the repo. Recorded here; **the brief has been amended to match.**

**P0-1 · `capture_sessions` is the live room, `training_sessions` is the durable ride**, linked at
End via `training_session_id`. So: **utterances and turns are children of `capture_sessions.id`,
the feel lives on `training_sessions`.** The brief previously said everything hangs off
`capture_sessions` — that was wrong and §0 is corrected. No third table.

**P0-2 · There is no exercise library.** Free-text exercises and homework on sessions, no table, no
IDs, no attribution metadata. **Resolution: Claude generates every reply and none is built.** What
varies is the context it's handed — this trainer's own past homework text for this rider first,
other opted-in trainers in her history second (inert), general third and marked. See brief §5.2.

> **The constraint this creates.** Claude may only name a trainer when a source record was
> actually supplied for it. A generated exercise wearing a real coach's name is a fabricated quote,
> said out loud, in front of her. Assert it in the generation path and test it by forcing an empty
> context — no name may appear.

**P0-3 · Fabricated feels.** Count, null, stop writing at End. No §5.5 ranking until only
human-chosen values remain.

**Also:** docs copy, three rules-doc amendments, `vector_in_session` at `internal`.

---

## Two things still missing from the plan

**A · The kill switch.** This ships into paid lessons. If Vector misbehaves mid-lesson there has to
be a way to stop it without a deploy. `vector_in_session` must be **evaluated at session start,
not cached at build**, and somebody has to own flipping it. Add to P0.

**B · Phase 4's gate is too weak.** *"Recorded mixed channel, clean stop"* can be satisfied on a
laptop with two browser tabs. The channel rule only matters when a trainer is genuinely coaching
over arena noise, at distance, on real hardware. **Phase 4 needs an arena, same as Phase 1** — and
they should be the same trip.

---

## Original P0 framing (superseded by the answers above)

These are unresolved in the repo and every phase depends on them. **Cursor answers them from the
codebase and reports back before building.** Do not pick silently.

**P0-1 · What is "the ride"? `capture_sessions` or `training_sessions`?**
Cursor's plan puts feel on `training_sessions` and proposes a *new* `session_utterances` table,
while brief §0 says everything hangs off `capture_sessions`. Both may be right if one is the live
room and the other is the ride record — but nobody has written down the relationship. Produce:
the two schemas, how a row in one becomes a row in the other, and a single sentence naming which
is the durable ride. **Every other schema decision follows this one.**

**P0-2 · Does a trainer exercise library exist?**
Brief §5.2 source 1 assumes exercises the trainer has recorded, prescribed, or annotated, with
attribution metadata. If there is no such table, **source 1 returns nothing, source 2 is already
inert pending consent, and v1 Vector is a general model with a marker clause** — a materially
different product from the one in the brief. Report what exists. If it's nothing, that's a
scoping conversation, not a build task.

**P0-3 · How many sessions carry a fabricated feel?**
`overall_feel: 5` has been written unconditionally. Every one of those rows is a lie in the field
§5.5 ranks on and the models retrieve by. Count them, then **null them** — do not leave them and
do not guess a replacement. Ranking exercise suggestions on rides nobody rated is the exact
failure the brief's "asked, never computed" rule exists to prevent, and it would ship silently.

**Also in P0:** copy the brief to `docs/`, make the three `CLAUDE.md` amendments, add
`vector_in_session` at `internal`.

**Gate:** the three answers written down. P0-3 executed.

---

## Phase 1 — Wake-word spike (throwaway code, in an arena)

**Cursor buried the single biggest unknown as one bullet inside its hardest phase.** *"On-device
wake 'Hey Vector' (e.g. Porcupine or equivalent)"* is not a task, it's a bet.

If a custom "Hey Vector" keyword doesn't hold up on a phone in a pocket, in wind, over hoofbeats,
at a false-accept rate that doesn't wreck a lesson — **the entire called-turn design changes.** It
becomes a headset button, which changes the gesture, the UI, and §5 of the brief. Finding that out
in Phase 3 wastes everything built around it.

- Throwaway harness, no product code, no UI.
- Custom keyword on-device (Porcupine or equivalent), armed and disarmed.
- **Tested in an actual arena, on an actual horse**, phone where a rider would really carry it.
- Measure: false accepts per 45-minute session, missed wakes out of 20 deliberate calls, and
  behaviour at walk / trot / canter.

**Gate:** a number for each, and a go/no-go on the wake word as primary input. **If it's no-go,
stop and re-open §5 before any further phase.**

---

## Phase 2 — The feel rating

Cursor's Phase 1, corrected.

- **P2-1 · Schema**, per P0-1. `value`, `scale` (5|10), `askedAt`, `answeredAt`, `deferrals`.
  Real columns, not JSON — `scale` gets queried and `deferrals` gets counted.
- **P2-2 · The end route** stops writing a feel at all. Unanswered is null, forever, everywhere.
- **P2-3 · The blocking sheet.** *"Blocking sheet component" is four separate defeats on mobile
  web, and it will ship dismissible if they aren't listed:* no close button, no backdrop click,
  no Escape key, no swipe-down, **no browser back / history pop**. Plus nothing pre-selected.
- **P2-4 · The coach-visible line.** `Your coach sees this for today's lesson.` — renders **only**
  when a trainer was on the session. Absent on solo rides. Cursor's plan omitted this entirely.
- **P2-5 · `Not now`** increments `deferrals` and re-presents on **every** subsequent app open.
  Not once. Not a skip.
- **P2-6 · The 48-hour window.** After it, the sheet never blocks again and the ask lives on the
  ride page. In the locks list, absent from the tasks.
- **P2-7 · One ride, never a queue.** Cursor wrote *"one ride queue max."* There is no queue —
  the most recent unrated ride is asked about, older ones stay unrated on their own pages. Don't
  build a queue of length one.
- **P2-8 · Display.** Unanswered renders the ask on the ride page. Never a zero, dash, or
  placeholder. In a list, omit the number entirely.

**Gate:** a rider on a real device cannot get past the sheet by any gesture, back button, or
reload — and every stored value is one a human chose.

---

## Phase 3 — Bookends and the transcript role

- **P3-1 · Open and close TTS.** Solo and with-trainer copy. Open plays **before capture begins
  and before the wake word arms** — that ordering is the consent artifact, not a nicety. Close
  plays before the claim screen and the rating.
- **P3-2 · The corpus exclusion — read this twice.** Cursor's plan says *"Transcript / polish
  consumers — exclude `vector` from trainer corpus."* **That is a downstream filter, which is
  exactly what the brief forbids.** Every consumer must forget once for a trainer's captured
  method to be silently poisoned by Vector's own output, and nothing in the product would show it.
  Enforce it at the source: `vector` rows either live where corpus queries structurally cannot
  reach them, or every corpus read goes through one function that cannot return them. **One
  chokepoint, not N filters.** Prove it with a query, not a code review.
- **P3-3 · Session strip.** `◇ SAY "HEY VECTOR"` idle, `◇ VECTOR` during a turn. No counters.
- **P3-4 · `VECTOR · ON/OFF`.** Silences called turns only. **Never the bookends** — those are
  disclosure, not a feature.
- **P3-5 · The one-time trainer line**, first session a trainer ever runs. Missing from Cursor's
  plan.
- **P3-6 · Event ordering.** `onLessonClosed` → Vector's close (both) → claim screen (trainer's
  device) → rating (rider's). Three outputs, one hook, none suppressing another.

**Gate:** the corpus query returns zero `vector` rows, demonstrated live.

---

## Phase 4 — Channel control

**Cursor had this as half a bullet: *"channel rule (wait / stop if trainer speaks)."*** It is
voice-activity detection on the trainer's track plus barge-in interruption of TTS playback, inside
a WebRTC room. It is the piece most likely to be quietly stubbed, and it's the one that protects
the trainer relationship.

- VAD on the trainer's published track.
- Vector holds while a voice is on the channel.
- Trainer speaks mid-playback → stop, don't resume, keep the text on screen.
- Same mechanism terminates the §5.4 conversation.

**Gate:** recorded mixed channel from a real session showing no overlap and a clean stop.

---

## Phase 5 — Called turns

- **P5-1 · Capture the question.** Wake → local earcon → speech to 1.2s silence or 12s cap.
  Nothing intelligible after the wake word → **zero output, audible or visible.**
- **P5-2 · Context assembly, not retrieval.** Claude generates; the work is gathering what it's
  grounded in. Pull this rider's past free-text exercises and homework with trainer name and date,
  hand them to Claude, and **assert no trainer name reaches the output without a `sourceSessionId`
  behind it.** Level 2 inert. General marked in its first spoken clause.
- **P5-3 · Ranking on the record only** — prior prescription, has she ridden it, **her feel on
  that ride**, already declined today. `groundedReason` cites the record or is null.
- **P5-4 · The crossing line**, said once: *"That's everything in your library. The rest of these
  are general."*
- **P5-5 · Two budgets.** Exercise: full, every step, paced, no cap. Answer: under 25 words. One
  code path must not truncate the other.
- **P5-6 · Both screens, full text, persists after playback.**
- **P5-7 · Latency.** Under 2.5s or file to screen; hard abandon at 4s. No progress sound.
- **P5-8 · Failure states.** Silent or one line. Never spoken. Cursor's plan says "per §8" and
  tasks none of them.

**Gate:** ten sample replies reviewed against a rider who *has* past homework on record and ten
against one who doesn't — none coaches in Vector's own voice, none justifies with an inference
about the horse, every general answer carries its marker, and **no name appears in the empty-context
set.**

---

## Phase 5b — The reference corpus (grounding level 3)

**Runs in parallel with everything, on a founder + counsel track, not an engineering one.** It is
the only phase that can damage the brand rather than just the release.

- **P5b-1 · Run the four-part screen** on every candidate (brief §5.3): published citable work
  exists · no welfare finding ever, not just none active · credentials verifiable from a governing
  body · re-screened before launch. **"Reputable" is not the test** — the name that triggered this
  rule was the most decorated rider in the sport.
- **P5b-1a · Anchor on institutions first.** Training scale, USDF education and directives, FEI
  rules, German FN guidelines. Uncontroversial, citable, cleanly licensable, no career to have a
  scandal — and it's the substrate under everything the named individuals teach. Named people go
  on top, judges and educators before competition riders.
- **P5b-1b · Build the removal path now, not later.** A name acquiring a welfare finding must be
  removable from the corpus, and `corpusChunkId` on every turn must make "which sessions cited
  this person" a query that returns in seconds. Test it before launch, not after you need it.
- **P5b-2 · Licensing before ingestion.** Reciting a living author's published work aloud in a paid
  product is a rights question. Counsel first. **Blocks the corpus, not the build.**
- **P5b-3 · Build it as a corpus, not a search.** Chunked, with a real citation on every chunk.
  No live web search anywhere in the request path — it is ten times over the latency budget and it
  misattributes.
- **P5b-4 · No chunk, no name.** If nothing in the corpus supports the reply, it is level 4 and it
  says so.

**Gate:** every name in the corpus has a written four-part screen result and a licensing position;
removing a name and finding every session that cited them both work; and a forced empty-corpus test
produces zero named citations.

---

## Phase 6 — The conversation

Not a loop — a thread. Vector is a consultant in the session and consultants get asked follow-ups.

- **P6-1 · The reply window.** ~8s after every Vector reply, **no wake word needed.** Reopens on
  each reply. This mechanic appears nowhere in Cursor's plan.
- **P6-2 · The addressing rule — the hard part.** Inside the window Vector responds to **only** a
  direct answer to its own question, or something addressed to it by name. **Everything else:
  silence.** A trainer talking to her rider is not a follow-up and the system cannot reliably tell
  the difference. Ambiguous is always silence — a wrong interjection into a lesson costs more than
  a missed follow-up.
- **P6-3 · Stop phrases by intent, not string match.** *"Stop," "that's enough," "okay Vector,"
  "we're good," "never mind."* A rider under pressure will not say the words you coded for.
- **P6-4 · Offers as an ordered array** with per-offer `response`, so nothing is offered twice.
- **P6-5 · Termination.** Accepted, silence through the window, a stop phrase, or **the trainer
  starts coaching** — Phase 4's mechanism, not a new one.
- **P6-6 · No cap on turns.** Grounding degrades visibly instead.
- **P6-7 · `"say that again"`** replays the last exercise from the top.

**Gate:** a real session where a rider declines three times, asks two follow-ups without the wake
word, the trainer says something to the *rider* mid-window and Vector stays silent, then the
trainer speaks over a reply and Vector stops mid-word.

---

## Phase 7 — Verify

§9 in full, at 390px, plus the ban-list grep. Add three checks Cursor's plan doesn't have:

- [ ] No per-participant audio routing exists — the earcon is local-only.
- [ ] No third session table was created.
- [ ] No inference field exists on any Vector type.
- [ ] No exercise-library table was created.
- [ ] No live web search exists in the request path.
- [ ] No other rider's identity appears in any reply, on screen, or in the transcript.
- [ ] Every named citation resolves to a real corpus chunk — forced empty corpus yields no names.
- [ ] Backend provenance is complete on every turn, and none of it is rendered.
- [ ] `vector_in_session` off mid-session stops Vector at the next session start, with no deploy.

---

## Sequencing note

Phases 2, 3 and 4 are independent of each other and of the Phase 1 outcome — they can run in
parallel or in any order once P0 clears. **Phases 5 and 6 depend on Phase 1 passing and P0-2
resolving.** If the wake word fails or there is no exercise library, ship Phases 2–4 alone: the
bookends, the rating, and a session that behaves properly are a real release on their own, and
called turns can follow.

---

*Written 2026-08-14 against `brief-14-vector-in-the-session.md`.*
