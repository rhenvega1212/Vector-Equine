# Brief 14 — Vector in the session

**For Cursor to build.** Vector's spoken presence inside a live comms-hub session, and the one
question asked after it. Decided 2026-08-14.

Companions: `CLAUDE.md` (repo rules — read first), `brief-12-ask-vector.md` (the same voice,
after the ride), `brief-13-rider-first-five-and-scan-in-claim.md` (**the session this lives
inside — see §0**), `VE-MVP1-blueprint-2026-07.md` (M1 — the comms hub).

> **Amends `CLAUDE.md` in three places.** The press-and-hold rule gets one carve-out (§3), the
> rider's per-ride number moves from 1–10 to 1–5 (§6), and the no-modals rule gets one named
> exception (§6). Make all three edits in the same PR.

---

## 0. This does not replace brief 13

Different layers of the same lesson. **Neither supersedes the other, and both ship.**

| | **Brief 13** | **Brief 14** |
|---|---|---|
| What it is | The plumbing around a session | What Vector says inside one |
| Owns | Flags, routes, onboarding, the `capture_sessions` schema, the trainer claim and conversion | The open, called turns, the close, the rating |
| The end-of-lesson moment | The **trainer's** guest device gets the claim screen | The **rider's** app gets the rating sheet |
| Build order | First. 14 attaches to what it creates. | After. |

**Three places they touch, and they must agree:**

1. **Session end is one event, two devices.** `onLessonClosed` fires Vector's spoken close to both
   parties, *then* brief 13's claim screen on the trainer's device and this brief's rating on the
   rider's. Two screens, two phones, one event. Build them off the same hook.
2. **Two existing tables, no third.** Verified in the repo 2026-08-14: **`capture_sessions` is the
   live room** (clock, join, claim, and everything Vector says or does in the session);
   **`training_sessions` is the durable ride** (the journal row, the lists, the feel). They're
   linked at End via `capture_sessions.training_session_id`. So Vector's utterances and turns are
   children of `capture_sessions.id`, **and the feel lives on `training_sessions`** — it belongs to
   the ride, not the room. **Create no third session table.**
3. **The rider's feel is visible to the coach** — for the lesson she personally taught, and only
   that one. Brief 13 STEP H1 already places it in the auto-shared debrief. That's settled; §6
   below defers to it.

Everything in brief 13 STEP A (nothing unfinished reaches a rider) applies here too: this whole
feature sits behind a flag until every box in §9 is checked.

---

## 1. What this is

**Vector speaks twice in a session. It opens it, and it closes it.** In between it is silent
unless someone says its name.

Two problems, one surface:

- A session currently starts and ends like a phone call. Nobody is told capture began.
- A rider at canter has both hands on the reins, and the moment the question is worth asking —
  *this isn't working, give me something else* — is the one moment she can't reach Vector at all.

**Read and build this solo-first.** One rider, alone, is the default case and the majority of
rides. A trainer on the channel is a variation, called out where it happens.

**The mental model for a called turn: consulting another trainer.** Not a search box, not a
lookup. Someone who knows this rider's history, offers something, asks if it's any use, and
offers another if it isn't — until something lands or the person actually in charge takes over.

---

## 2. The decisions

| Decision | What it means |
|---|---|
| **Vector speaks twice** | The open and the close. Plus a turn when called. There is no fourth reason. |
| **The open declares capture** | Spoken every session, not configurable. For a scanned-in trainer with no account it's the only notice she ever receives. |
| **Wake word, session only** | `Hey Vector` arms when the session starts, disarms when it ends. Never outside one. |
| **Answers are shared** | Both people hear every called turn. There is no private answer. |
| **An exercise is spoken in full** | Every step, start to finish. A rider at canter cannot read a screen. |
| **It offers until something lands** | Turned down, it offers another. And another. It's consulting, not answering. |
| **Follow-ups need no wake word** | An ~8s window after each reply. Inside it, Vector answers only what's addressed to it. Ambiguous → silence. |
| **A citation is an endorsement** | Four-part screen on every name, institutions before individuals, judges and educators over competition riders. See §5.3. |
| **Names require records** | Vector may name a person only when a source record was supplied for that name. |
| **The trainer's voice ends anything** | Mid-sentence, mid-loop. Vector stops and does not resume. She's coaching; that outranks a playback. |
| **Vector never coaches in its own name** | Every prescriptive line names the trainer, or the trainer whose exercise it is, or is marked general. |
| **Vector never evaluates the ride** | No *"nice ride,"* no *"good session."* It asks; the rider judges. |
| **Selection is grounded in the record** | Vector ranks on what happened, never on a judgment about the horse. See §5. |
| **The trainer ends the session** | In a lesson it's her call. Solo, the rider's. |
| **The feel is asked after, and it blocks** | Not out loud, not in front of anyone, and not easily skipped. See §6. |
| **`vector` is its own speaker role** | Excluded from trainer attribution, the knowledge base, and model training. Bookends included. |

### Rejected (Decisions Graveyard)

- **"Speak step one, the rest is on your screen."** A rider mounted and moving cannot read, and
  half an instruction is worse than none. Exercises are spoken end to end. This was wrong in the
  first draft.
- **A hard cap on alternatives.** A trainer consulted for a second opinion doesn't stop at two.
  The loop ends when something is chosen or the trainer speaks — see §5.
- **"Welcome to Vector Equine."** Hospitality-desk language. The brand identifies itself the way
  a radio net does — says its name and moves.
- **"Nice ride, Rhen."** Vector grading the ride. On the day the rider came off, it's the worst
  sentence in the product — and that's the day it matters most.
- **Asking the feel out loud.** Required a separately addressable rider audio leg for one question
  per session, and in a lesson the rider rounds up with her trainer listening.
- **A skippable, ask-once rating.** Too passive for a number this load-bearing. It now blocks.
- **Teaching the wake word out loud.** *"Feel free to say Hey Vector if you have questions"* on
  session forty is the app talking to itself. It's a label on screen.
- **A private answer to a called turn.** A rider quietly consulting a second opinion about the
  person twenty metres away. Poisons the trainer relationship, which is the growth engine.
- **Vector volunteering unprompted.** That's in-ride feedback — M5, gated behind M4 precision, and
  the live surface of the Sarcos claim. It doesn't arrive early through a comms feature.
- **Live web search mid-lesson.** Ten times over the latency budget, and a model summarising
  search results misattributes to real people. Replaced by a vetted corpus built ahead of time.
- **A shared library of strangers' exercises.** Out of scope — but *this rider's own history with
  other trainers*, and *this trainer's own method across her own roster*, are both in scope and
  neither is the same thing. See §5.2.
- **Naming which rider an exercise was given to.** Level-1 material crosses a trainer's roster;
  rider identity never does.
- **Press or tap to activate in-session.** A rider at canter has no free hand.
- **Cloud wake-word detection.** Forty-five minutes of a paid lesson streamed to a service to be
  told "not it" nine hundred times.
- **A spoken failure message.** Vector never interrupts to announce it couldn't help.

---

## 3. Why this doesn't break the press-and-hold rule

`CLAUDE.md` says press-and-hold because a toggle *"can't record a whole barn conversation by
accident."* The objection is about capture nobody consented to. Inside a session that's already
answered — both sides record continuously by design, the mic is already hot, the transcript is
already being written. A wake word opens no new capture surface.

> **Press-and-hold everywhere, except inside a live session, where `Hey Vector` is armed
> on-device from session start to session end.**

Add that bullet to `CLAUDE.md` § Voice. It's the only place the rule bends.

---

## 4. The open

Plays once, on session start, before capture begins and before the wake word arms.

**Solo:**
> **"Vector Equine. You're on, Rhen. Capturing from here."**

**With a trainer** — both hear it:
> **"Vector Equine. Rhen, Emma — you're both on. Capturing from here."**

Three jobs in eleven words: says the brand once, confirms the link by naming who's on it, and
declares capture.

- First names only, as entered. No name available → drop the name, never the capture clause.
- **The capture clause is mandatory and not configurable anywhere in the app.** It's the
  disclosure, and for an unclaimed trainer it's the whole consent record. Legal review pending —
  see §10.
- Nothing else. No how-to, no menu, no "let's get started."

The wake word is taught on screen: the session strip reads `◇ SAY "HEY VECTOR"` when idle and
`◇ VECTOR` during a turn. No counters, no onboarding state.

> **The no-wake variant.** If the wake word doesn't survive its arena spike, the bookends and the
> rating still ship — but **the strip hint must not.** A session advertising a gesture that does
> nothing is a visible lie, and the open would imply a Vector that can't be called. In that
> release the strip carries nothing and `VECTOR · ON/OFF` doesn't render. Spec it now; it's cheap
> before the fallback is needed and awkward after.

---

## 5. A called turn

**`Hey Vector`, then the question, one breath.** No confirmation prompt, no *"yes?"*

**Detection.** On-device, against the local mic. Nothing leaves the phone before the wake word
fires. Firing plays one soft earcon to the asker — under 200ms, a note, not a word. Speech
captures until 1.2s of silence or a 12s cap.

**Nothing intelligible follows → Vector does nothing at all.** No sound, no line, no *"didn't
catch that."* A false wake in an arena costs exactly zero.

**Speaking.** Vector speaks to the shared mix and writes to both screens at the same time. Either
person can call it; both hear it.

> **The channel rule:** if a voice is on the channel, Vector waits for a gap. If the trainer
> starts talking while Vector is speaking, Vector stops and does not resume — the text stays on
> screen. Thresholds are Cursor's call; the behaviour isn't.

**Speed.** Under 2.5 seconds from the end of the question, or Vector doesn't speak at all. Past
four seconds the rider has ridden on, and a stale answer spoken into a lesson is worse than
silence — it files to the screens and the timeline instead. Never a progress sound, never a
"still thinking."

### 5.1 Two kinds of reply, two different budgets

| | **An answer** | **An exercise** |
|---|---|---|
| What it is | A fact, a comparison, a why | Something to go and ride |
| Length | Under 25 words | However long it takes |
| Spoken | In full | **In full, every step** |
| On screen | The same text | The same text, and it stays |

The old rule — speak the headline, put the rest on screen — is dead. A rider mounted and moving
cannot read. **An exercise is spoken start to finish**, in steps, with a beat between each so she
can set up and ride it rather than memorise ninety seconds of speech.

- It writes to **both** screens in full, simultaneously, so the trainer can follow along and refer
  back to it after.
- The trainer's voice stops it, per the channel rule. So does *"Hey Vector, stop."*
- *"Hey Vector, say that again"* replays the last exercise from the top.

### 5.2 Where it comes from

**Claude generates every reply.** There is no exercise-library table in the repo, and v1 does not
build one — verified 2026-08-14. So what varies between replies isn't the engine. It's **what the
engine was given to work from.**

**Four grounding levels, best first.** Each is spoken differently. All four are recorded precisely
in the backend — see §5.6.

**1 · Your trainer's own method.** The free-text exercises and homework she has written — on this
rider's past sessions, **and on her other riders' sessions too.** It's her method either way, she's
standing in the arena, and she'd say the same thing herself.

> *"Emma had you doing this in June —"* · *"This is one of Emma's —"*

> **Rider identity never crosses.** The exercise text moves across her roster; who she gave it to
> does not. Never *"she gave this to Sarah in March."* Not in speech, not on screen, not ever. The
> other rider is not a party to this conversation.

Requires a trainer opt-in — *let Vector draw on my method across my own riders* — because her
method is what she sells. Assume most say yes; ask anyway.

**2 · Another trainer, in this rider's own history.** Exercises given to *this rider*, by any
trainer who opted in. Attributed by name and occasion — *"this one's Kate's, from your clinic in
May."* The consent scope is why it works: **the trainer opted in, and the rider was there.**
**Inert today.**

**3 · A published authority.** A curated reference corpus of named, citable sources. Cited by
person and work. See §5.3 — this level is the one with real hazards attached.

> *"Janet Foy writes about this in her book on judging —"*

**4 · General.** Nothing on record. **Marked in the first spoken clause**, never attributed to a
person.

> **The attribution assertion.** Claude may name a person **only** when a source record was
> actually supplied for that name. A generated exercise wearing a real professional's name is a
> fabricated quote — said out loud, recorded in a transcript, in a paid product. Enforce it in the
> generation path, not in review.

It says once, and only once, when it drops a level:

> *"That's everything Emma's given you for this. The rest are general."*

The trainer on the channel is free to take any of it or wave it off. Vector's job is to say clearly
where it came from so she can make that call in one second.

### 5.3 The reference corpus (level 3)

**This is not live web search.** Two reasons, each fatal on its own:

- **Latency.** The budget is 2.5 seconds to first spoken word. Search, fetch, read, synthesise is
  an order of magnitude over that. Live search cannot happen inside a lesson.
- **Attribution safety.** A model summarising search results blends and misattributes. Doing that
  to a named living professional, aloud, in a recorded session, is the one failure this feature
  cannot survive.

So level 3 is **built ahead of time**: published books, articles, and governing-body material from
named authorities, ingested once, chunked, with a real citation on every chunk. A level-3 reply
cites the work — not "the internet." **If no chunk supports the reply, it is level 4 and it says
so.** No chunk, no name.

### The screen

**"Reputable" is not a criterion — it's what let the problem in.** Charlotte Dujardin was, by any
conventional measure, the most reputable dressage rider alive: six Olympic medals. Reputation is
exactly what fails here. So the rule is a test, not a judgment:

**A name enters the corpus only if all four hold.**

1. **Published, citable work exists.** A book, an article, governing-body education material. No
   published work means nothing to cite, which means citing them is citing hearsay or generated
   text wearing their name. This alone excludes most competition riders.
2. **No welfare finding, sanction, suspension, or unresolved public welfare controversy — ever.**
   Not "none currently active." A served ban is still a ban.
3. **Credentials verifiable from a governing body** — a judge's licence, a certification, an
   official role. Not results, not follower count.
4. **Re-screened before every launch, and on a schedule after.** This changes.

**Institutions before individuals.** The safest and most citable material isn't a person at all:
the training scale, USDF education and directives, FEI dressage rules, the German FN guidelines
underneath all of it. Uncontroversial, genuinely authoritative, cleanly licensable, and no career
to have a scandal. **Anchor the corpus there and add named individuals on top** — most of what any
of these trainers teach sits on that substrate anyway.

**Judges and educators over competition riders**, as a class. A judge's authority comes from
published work, which is the thing you can actually cite. A rider's comes from results, and their
methods are usually not published at all. The safer source class is also the more citable one.

**Removal and recall.** If a name in the corpus later acquires a welfare finding, it comes out —
and because §5.6 stores a `corpusChunkId` on every turn, **you can find every session where they
were cited.** Transcripts are permanent and nothing spoken can be unsaid, but you can stop citing
going forward and you can answer the question when someone asks. That recall ability is most of
why provenance is stored at all.

> **On the three names floated:** Dujardin fails on 2, Kittel fails on 2, **Janet Foy passes the
> shape of all four** — run her through it formally anyway. A welfare-tech brand citing a rider
> sanctioned for a welfare offence is one screenshot.

**Licensing is unresolved.** Ingesting a living author's book and reciting it aloud in a paid
product is a rights question. Short cited paraphrase sits differently from reproduction, and
governing-body educational material sits differently again. Counsel before the corpus is built,
not after. **Blocks the corpus, not the build** — see §10.

**A thin corpus at launch is fine.** A strict screen means starting small. Level 4 covers the gap,
marked and honest, and the corpus grows. Never loosen the screen to fill it out.

> **Level 3 is a follow-on release, not a v1 blocker.** It's the only dependency in the whole brief
> with no bounded completion date — a screened name list plus a licensing position plus ingestion,
> two of which sit with counsel. Putting that on the critical path is how the first release slips
> by months. **Ship v1 at levels 1 and 4** — the trainer's own method, and general when there's
> nothing on record. A brand-new rider gets honest general answers, marked as such, until the
> corpus lands. Level 3 then arrives as the first upgrade, and it's the one that makes a first
> session with no history actually good.

### 5.4 The turn is a conversation, not an exchange

Vector is acting as a consultant in the session. Consultants get asked follow-ups.

After Vector speaks, a **reply window** stays open for about eight seconds. Inside it, **no wake
word is needed.**

**What Vector responds to inside the window — and only these:**

- A direct answer to the question it just asked: *"yes," "no," "we did that yesterday."*
- Anything addressed to it by name: *"Vector, what about on a circle?"*

**Everything else in the window, it stays silent for.** A trainer talking to her rider is not a
follow-up, and Vector cannot reliably tell the difference. When it's ambiguous, silence — always.
A wrong interjection into a lesson costs more than a missed follow-up.

Each reply reopens the window. That's the thread: ask, answer, follow up, answer, until it ends.

**How it ends — any of these, immediately:**

- **A stop phrase.** *"Stop," "that's enough," "okay Vector," "we're good," "never mind."* Match
  intent, not a magic string — a rider under pressure will not say the exact words you coded for.
- **The trainer starts coaching.** The channel rule. Vector stops mid-word and does not resume.
  When the professional in the arena has an opinion, the consultation is over.
- **Silence through the window.**
- **An exercise is accepted, or she just rides it.**

There is **no cap on turns.** As long as she keeps asking, it keeps answering — the way a second
opinion would. The grounding degrades visibly as it goes, so she always knows whether she's getting
her trainer's method, another trainer's, a published source, or something general.

> This is the operational opposite of the **feature kill switch** (`vector_in_session`), which
> turns Vector off across all sessions without a deploy. Talking over it stops one turn. The flag
> stops the feature. Both exist; don't conflate them.

### 5.5 How it picks — and the line it does not cross

Vector ranks candidates on **what is in the record**:

- Whether a trainer prescribed it for this same problem before
- Whether this rider has ridden it, and how recently
- What she rated the ride she rode it in *(this is what the feel tag in §6 is for)*
- Whether it's already been offered and turned down in this session

> **Vector never selects or justifies on an inference about the horse.** *"This suits Dean because
> he's croup-high"* is a claim nothing in the product can back until M3 and M4 land. Selection is
> grounded in what happened, not in a judgment about the animal.

So the reason, when it gives one, cites the record:

> *"Emma gave you this one in June for the same thing."* ✓
> *"This should help him sit."* ✗

### 5.6 Provenance — two layers

Everything Vector says is labelled **`vector`** in the transcript. Where it came from is recorded
at two different resolutions.

**Spoken and on screen — the category.** The rider and trainer need to know what *kind* of thing
they're hearing, because that's what tells them how much weight to give it:

| Level | What they hear |
|---|---|
| 1 | *"Emma had you doing this in June —"* |
| 2 | *"This one's Kate's, from your clinic in May —"* |
| 3 | *"Janet Foy writes about this in —"* |
| 4 | *"This one's general —"* |

**Backend — the exact record.** Never surfaced, always stored: which session the text came from,
which trainer wrote it, which corpus chunk and citation, which model and version generated the
reply, and whether it was our own model once that exists. This is what makes an answer auditable a
year later when someone asks where a claim came from.

The customer-facing rule is **category, not citation** — except at level 3, where the person's
name *is* the category. Nobody in an arena needs a session ID read to them.

### 5.7 How a reply is written

- **Source first, content second.** Always.
- **Never coaching in Vector's own name.** Every prescriptive line names the trainer whose
  exercise it is, or is marked general.
- **Numbers stated flat.** A measurement, no conclusion attached.
- **Never adjudicating the trainer.** *"Is she right?"* → *"That's Emma's call."*
- **Nothing about the horse's body.** No load, no soundness, no watch-language mid-ride.
- **When it doesn't know, one line.** No apology, no improvising.

**A worked exchange**

> **Rider:** *"Hey Vector, give us something new for the changes — this isn't working."*
>
> **Vector:** *"Emma gave you this one in June for the same thing — counter-canter to the change
> on the diagonal. Pick up left lead and come across the long diagonal. Three or four strides of
> counter-canter after X, let him straighten, then ask for the change. If he swaps late behind,
> come back to trot, rebuild, and ride it again from the short side. Want to try that one?"*
>
> **Rider:** *"No, we did that yesterday."*
>
> **Vector:** *"Then that's everything Emma's given you for changes. This next one's general —
> changes on a figure of eight…"*

**What breaks it**

> ✗ *"You should ride the counter-canter first — he's late behind because your outside leg is
> coming back too far."*

Coaching in Vector's own voice, a claim nothing can back, and an inference about the horse.

---

## 6. The close, and the feel

### The close

The trainer ends the session (solo, the rider does). Vector says one thing, both hear it:

> **"That's it — capture's off."**

Symmetry with the open. She was told when it started; she's told when it stopped. No evaluation
of the ride, no promise of a debrief to a trainer who may have no account to receive one. Then the
wake word disarms and the session is over.

**Vector asks nothing at the close.** The rider is dismounting, the horse is walking off, someone
is talking to her. It's the worst possible moment to ask for a number.

**The same `onLessonClosed` event drives two other screens on two other devices** — brief 13's
claim teaser on a guest trainer's phone, and the rating below on the rider's. Vector's spoken
close plays first, to both. See §0.

### The rating

Created the moment the session ends. **Presented as a blocking sheet over the app the next time
the rider has it in front of her** — which, since she or her trainer just ended the session on a
phone, is usually within seconds.

> `TODAY · WITH EMMA · DEAN`
> **How did it feel?**
> `1` `2` `3` `4` `5`
> `1 · a fight` — `5 · effortless`
>
> `Your coach sees this for today's lesson.`
>
> *Not now*

That line renders only when a trainer was on the session. Solo rides don't show it.

**It blocks.**

- No close button. No tap-away. No swipe-down. No back gesture.
- **Nothing pre-selected** — there is no default position to tap through.
- Two ways past it: **give a number**, or **`Not now`**.
- **`Not now` is not a skip.** It re-presents on the *next* app open, and the one after that,
  until she answers or the window closes.
- **Window: 48 hours.** After that it stops blocking and the ask lives quietly on the ride page. A
  number recalled from three days ago is a guess, and a guessed tag is worse than a missing one.
- **One ride, never a queue.** Two unrated rides means she's asked about the most recent. The
  older one stays unrated on its own page.

> **This is a modal, and modals are against the layout language.** It is a deliberate, single,
> named exception because this number is load-bearing and a passive ask does not get answered.
> **It is not precedent.** No other screen in the app gets a blocking sheet.

**Why `Not now` exists at all.** A rider with no way out taps whatever clears the screen fastest,
and a dismissal-tap is indistinguishable from a real answer in the field the models trust. One
deliberate exit keeps every stored number one she actually chose, while `Not now` re-asking every
single open means nobody quietly escapes it either.

### What the number is for

**It's a retrieval tag, not a metric.** It's how the models — and Vector, in §5.5 — find which
historical sessions worked and which didn't. That's why it's coarse, why it's the rider's own
word, and why it's never computed from anything.

It stays **feel**, not *success*, in rendered copy — `CLAUDE.md` rule 5, the app never grades the
rider. Feel is also the better tag: it's the thing the rider can actually report.

**The coach sees it, for the lesson she taught.** Brief 13 STEP H1 already places the rider's feel
in the auto-shared debrief, and that stands: a trainer learning the ride felt like a 2 when she
thought it went fine is the single most useful line in the write-up. Scope is that one session —
her access to anything else still runs through rider approval. **This is not hidden from the
rider:** the rating sheet carries one quiet line, `Your coach sees this for today's lesson.` A
number collected under a false impression of privacy is worse than one collected honestly.

### The scale — 1–10 becomes 1–5

Founder decision. `CLAUDE.md` § *Numbers that belong to the rider* becomes 1–5, end labels only:
`1 · a fight` / `5 · effortless`. Five options are answerable at a glance; ten aren't.

**Never rescale a number a rider gave you.** Halving a 7 into a 3.5 and rounding fabricates an
answer she never gave, in the one field the product promises is hers. So the scale is **stored
with the value**: historic rides keep `scale: 10` and display as answered, new rides are
`scale: 5`, and any chart spanning both normalises for plotting only.

---

## 7. The transcript

The transcript is the corpus. Every trainer's captured method is built from it, and that corpus is
the knowledge-base asset the business rests on.

- Vector's speech is a **distinct speaker role: `vector`** — bookends included. Never `trainer`,
  never `rider`.
- **`vector` turns are hard-excluded at the schema level** from trainer attribution,
  graded-assessment extraction, the knowledge base, movement segmentation, and model training.
  Not by a downstream filter someone can forget.
- **Wake-word utterances are kept** as normal `rider`/`trainer` turns flagged
  `addressedToVector` — and so are loop replies. *What riders turn down, and what they say when
  they turn it down,* is one of the most valuable signals the platform will ever collect.
- Stamped on the single session clock, so a Vector turn joins to the sensor stream later.
- **In the debrief, `vector` turns render visually distinct** from the trainer's. The debrief is
  the lesson returned *in her words.* Vector's words are not hers.

> If a Vector line ever enters the trainer corpus as coaching, the model trains on its own output
> wearing a trainer's name, and that trainer's captured method degrades silently with nothing in
> the product to show it. Highest-stakes regression in the brief.

---

## 8. Data shape, behaviour, and controls

Utterances and turns are children of `capture_sessions.id` (the live room). **`Feel` lives on the
`training_sessions` row** (the durable ride), reached via `capture_sessions.training_session_id`.
See §0. **No third session table.**

```ts
type SessionUtterance = {
  sessionId: string                       // capture_sessions.id
  atMs: number                            // single session clock
  speaker: 'rider' | 'trainer' | 'vector'
  text: string
  addressedToVector?: boolean             // rider/trainer turns, incl. loop replies
  excludedFromCorpus: boolean             // ALWAYS true when speaker === 'vector'
}

type VectorTurn = {
  sessionId: string
  askedAtMs: number
  askedBy: 'rider' | 'trainer'
  question: string
  offers: {                               // one per exercise offered in the loop
    kind: 'answer' | 'exercise'
    text: string                          // spoken in full, written in full
    grounding: 'this-trainer' | 'other-trainer' | 'published' | 'general'
    spokenCategory: string                // what they heard — see §5.6
    provenance: {                         // backend only, never rendered
      sourceSessionId?: string            // levels 1–2: where the text came from
      trainerId?: string                  // levels 1–2: who wrote it
      corpusChunkId?: string              // level 3
      citation?: string                   // level 3: person + work
      model: string                       // engine + version; our own model, later
    }
    attribution?: {                       // a NAME may appear only with a record behind it
      personName?: string
      occasion?: string                   // "your clinic in May"
    }
    groundedReason?: string               // from the record only — never an inference
    response?: 'accepted' | 'declined' | 'no-reply' | 'trainer-took-over'
  }[]
  spoken: boolean                         // false when the 4s window closed
  interrupted: boolean                    // someone spoke over it; playback stopped
}

type Feel = {
  rideId: string                          // training_sessions.id — the ride, not the room
  value: number                           // as the rider gave it — never rescaled
  scale: 5 | 10                           // 10 = answered before this brief
  askedAtMs: number
  answeredAtMs?: number                   // absent = asked, not answered
  deferrals: number                       // "Not now" count
}
```

- `excludedFromCorpus` is set by the writer, never inferred by the reader. Any consumer that reads
  utterances without honouring it is a bug.
- `offers` is an ordered array, not a single answer. `response` on each is what makes §5.5's
  "already offered and turned down" check possible.
- `grounding: 'general'` **requires** the marker clause in `text`. Assert it in the generation
  path.
- **`attribution.personName` may only be set when `provenance` carries a matching record** —
  `sourceSessionId` for a trainer, `corpusChunkId` + `citation` for a published authority. A name
  with nothing behind it is a fabricated quote said aloud. Assert this at the type boundary, not
  in review.
- **No other rider's identity may appear in `text`, `attribution`, or on screen.** Level-1 material
  crosses a trainer's roster; the rider it was written for does not. Strip at assembly.
- `provenance` is never rendered. `spokenCategory` is the only thing the rider hears.
- `groundedReason` is nullable and must cite the record. There is no field for an inference about
  the horse, deliberately.
- **`Feel.scale` is written in the same transaction as `value`, or not at all.** An unanswered feel
  carries no scale — stamping one on a row nobody answered recreates the exact "looks like data but
  isn't" problem that the hardcoded `overall_feel: 5` created. Never recomputed, no migration script
  touches it.

**Trainer control.** One toggle in the session bar: `VECTOR · ON` / `OFF`. Instant, no confirm.
Off disarms the wake word for both parties that session. **It does not silence the bookends** —
those are capture disclosure, not a feature. Default ON, with a one-time line the first session a
trainer ever runs: *"Your rider can call Vector during the lesson. Turn it off any time."*
Turning it off is stored and never surfaced to the rider.

**Two flags, not one.**

- **`vector_in_session`** — the open, the close, called turns. Evaluated **at session start, not
  cached at build**, so flipping it off stops Vector at the next session without a deploy. Someone
  owns flipping it; write down who.
- **`vector_feel_prompt`** — the blocking rating sheet. It's a rider-facing behaviour change with
  nothing to do with a live session: it fires on app open, days later, and can't be dismissed. You
  will want bookends on with the sheet off, or the reverse. Two flags is cheap now and expensive to
  retrofit the first time the sheet annoys someone.

**Failure.** Every failure is **silent, or one line on a screen.** Nothing is ever spoken to
announce a failure into a live lesson. Three that need explicit handling:

| Case | Behaviour |
|---|---|
| Can't reach Vector | One soft descending earcon to the asker, one line on the session screen. |
| Comms drop mid-turn or mid-loop | Discard it. Do not replay on reconnect — the moment is gone. |
| Session ends abruptly | Everything captured is kept. The rating is created and blocks as normal. |

---

## 9. Acceptance criteria

**The session**

- [ ] The open plays once, before capture begins and before the wake word arms; the capture clause
      is present in every variant and configurable nowhere.
- [ ] The wake word arms on session start and is verifiably disarmed on session end — with the mic
      still open for comms.
- [ ] Detection runs on-device; no audio leaves the phone before the wake word fires.
- [ ] A false wake with no question produces zero audible and zero visible output.
- [ ] The earcon plays only to the asker; everything else plays to both.
- [ ] Vector does not overlap a speaking trainer, and stops without resuming when she starts —
      verified on a recording of the mixed channel.
- [ ] The close plays to both, and **Vector asks no question at the close.**
- [ ] **No per-participant audio routing exists anywhere in this feature.**

**Measured, not asserted** — four numbers, because each of these can pass every checkbox above and
still be broken

- [ ] **Time to first spoken word: p50 and p95 over 30 real turns, on arena network.** If p50 is
      over 2.5s, Vector almost never speaks and everything files silently to a screen a mounted
      rider can't read. Every other box goes green while the feature does nothing. **Revisit the
      design, not the threshold.**
- [ ] **Wake-word false accepts per 45 minutes, and misses out of 20 deliberate calls**, at walk,
      trot and canter, in an arena.
- [ ] **Unwanted interjections per 45 minutes of real lesson audio** — Vector answering something
      that wasn't addressed to it inside the reply window. Target zero; above it, the addressing
      rule reopens.
- [ ] **Would the trainer run it again? — asked twice, not once.**
      - **Early, after the bookends / rating / channel work and before called turns are built.**
        Vector opens the session, closes it, and stays silent. One question: *did any of that get
        in your way?* This catches the social problems — a capture notice that lands badly, a
        close that interrupts, a rating that annoys her rider — while they're still cheap.
      - **Final, before `vector_in_session` leaves `internal`.** Two trainers, two real paid
        lessons each, everything live. *Would you run your next lesson with this on?* **Two noes
        and the flag stays at `internal`, whatever else is green.**

      `VE-MVP1-blueprint` M1 set this bar for the comms hub alone. This puts a third voice into the
      same paid lesson, so it gets asked earlier and again.

**Exercises and the loop**

- [ ] An exercise is spoken end to end — no truncation, no "the rest is on your screen."
- [ ] The same full text appears on **both** screens and persists after playback.
- [ ] *"Hey Vector, stop"* halts playback; *"say that again"* replays from the top.
- [ ] *"Want to try that one?"* opens a reply window that accepts yes/no **without** a wake word.
- [ ] A decline produces another offer; the loop continues with no cap.
- [ ] The trainer speaking ends the loop immediately and Vector does not resume.
- [ ] Silence in the reply window ends the loop — it does not offer again unprompted.
- [ ] The same exercise is never offered twice in one session.
- [ ] Grounding degrades in order and Vector says so once when it crosses into general.
- [ ] **No reply names a trainer without a `sourceSessionId` behind it** — verified by forcing an
      empty context and confirming no name appears in twenty generations.
- [ ] An other-trainer exercise names the trainer and the occasion.
- [ ] Ten sample replies: none coaches in Vector's own voice, none justifies a choice with an
      inference about the horse, and every non-exercise answer is under 25 words.

**The rating**

- [ ] It blocks: no close button, no tap-away, no swipe-down, no back gesture.
- [ ] Nothing is pre-selected.
- [ ] `Not now` re-presents on every subsequent app open until answered or 48 hours pass.
- [ ] After 48 hours it stops blocking and the ask remains on the ride page.
- [ ] One ride only, never a queue.
- [ ] `Your coach sees this for today's lesson.` renders when a trainer was on, and not on solo
      rides.
- [ ] An unanswered feel renders the ask on the ride page — never a zero, dash, or placeholder.
- [ ] `Feel.scale` is stamped at capture; no code path rescales a stored value, and a historic
      1–10 ride still displays the number the rider gave.
- [ ] This is the only blocking sheet in the app.

**The record**

- [ ] `vector` utterances — bookends included — return zero rows from the trainer-attribution
      pipeline.
- [ ] Wake-word utterances and loop replies persist as `rider`/`trainer` turns with
      `addressedToVector: true`.
- [ ] `VECTOR · OFF` silences called turns and does not silence the bookends.
- [ ] `CLAUDE.md` updated: the §3 carve-out, the 1–5 scale, and the named modal exception.
- [ ] `vector_in_session` and `vector_feel_prompt` are separate flags, each independently
      switchable, and `vector_in_session` is evaluated at session start rather than cached.
- [ ] With the wake word disabled, the strip hint and `VECTOR · ON/OFF` do not render — the
      fallback release advertises nothing it can't do.
- [ ] `feel_scale` is never present on a row where `value` is null.
- [ ] Utterances and turns attach to `capture_sessions`, the feel to `training_sessions` — no
      third session table exists.
- [ ] `onLessonClosed` drives Vector's close, brief 13's trainer claim screen, and the rider's
      rating without any of the three suppressing another.
- [ ] Grepping rendered and spoken copy returns nothing for `AI`, `score`, `grade`, `verdict`,
      `execution`, `judged`, `injury`, `lameness`, `diagnos`, `success`.
- [ ] No bordered cards, no filled-gold buttons, and no modal other than the rating. 390px.

---

## 10. Still open

- **Legal review of the spoken capture notice.** For a scanned-in trainer it's the entire consent
  record. Two-party-consent states, and whether a declaration is enough versus an acknowledgement,
  is a counsel question. **Blocks ship, not build.**
- **What "opted in" means for grounding level 2.** A trainer opting in to her exercises being
  surfaced to her own former rider, by another trainer's Vector, needs a consent artifact that
  doesn't exist yet. Until it does, level 2 returns nothing and the path is inert. **Blocks level
  2, not the build.**
- **Who goes in the reference corpus.** The §5.3 screen decides the shape; the founder decides the
  list. **Blocks level 3, not the build.**
- **Is a welfare finding permanent?** The screen says ever, not currently — one strike, no path
  back, even after a ban is served. That's the safe reading for a brand whose non-negotiable is
  welfare, and it's stricter than the sport itself. Confirm it's the position you want, because
  it's the one the brief is written on.
- **Licensing for the corpus.** Reciting a living author's published work aloud in a paid product
  is a rights question. Counsel before ingestion. **Blocks level 3, not the build.**
- **Trainer opt-in for level 1 across her roster.** Her method moving between her own riders is
  almost certainly an easy yes, but it's her IP and it has to be asked. Level 1 works within this
  rider's own sessions without it.
- **A real exercise library.** There isn't one — v1 grounds on free-text homework from past
  sessions, which works and improves on its own but has no IDs, no structure, and no way to say
  "she's ridden this exact thing three times." A structured library is the obvious next asset and
  is deliberately not in this brief.
- **The kill switch.** This ships into paid lessons. If Vector misbehaves mid-lesson there must be
  a way to stop it without a deploy — `vector_in_session` has to be evaluated at session
  start, not cached at build. Nobody has written down who can flip it or how fast it takes effect.
- **A physical fallback for the wake word.** Wind, a covered arena, a horse blowing. A headset
  button probably has to exist.
- **Group lessons.** One trainer, four riders. Who does a called turn answer, and does everyone
  hear it? The shared-mix decision was made for a two-person room.
- **Does the trainer get a way to push back into the loop** — *"Hey Vector, not that one"* — or
  does she just say it to the rider like a human?

---

## 11. Cursor prompt (paste this)

> Build Vector's presence in the live session per `brief-14-vector-in-the-session.md`, following
> `CLAUDE.md` for tokens, type, and atmosphere, and `brief-12-ask-vector.md` for the voice. Build
> solo-first — one rider is the default, a trainer on the channel is a variation. The mental model
> for a called turn is consulting another trainer, not querying a database.
>
> **This does not replace `brief-13-rider-first-five-and-scan-in-claim.md` — build 13 first and
> attach to it.** Everything here hangs off the existing `capture_sessions` row; create no second
> session table. `onLessonClosed` drives three things at once: Vector's spoken close to both
> parties, brief 13's claim screen on a guest trainer's device, and the rating below on the
> rider's. None of the three suppresses another.
>
> **Vector speaks twice.** An **open**, once per session, before capture begins and before the
> wake word arms: *"Vector Equine. You're on, Rhen. Capturing from here."* — both names when a
> trainer is on. First names only; the capture clause is mandatory and configurable nowhere. And a
> **close** when the session ends: *"That's it — capture's off."* Vector asks no question at the
> close.
>
> **Called turns.** An on-device wake word armed only between session start and session end,
> hard-disarmed on end, nothing leaving the phone before it fires. Firing plays a sub-200ms earcon
> to the asker only, captures until 1.2s of silence or a 12s cap. A wake word with nothing
> intelligible after it produces no output at all. If a voice is on the channel Vector waits; if
> the trainer starts while it's speaking, it stops and does not resume — thresholds are your call,
> the behaviour isn't. An answer not ready within 4s isn't spoken; it files to the screens.
>
> **Exercises are spoken in full** — every step, start to finish, with a beat between steps, and
> written in full to both screens at the same time. Never truncate and never say "the rest is on
> your screen." Non-exercise answers stay under 25 words. Support *"Hey Vector, stop"* and *"say
> that again."*
>
> **The conversation.** After an exercise Vector asks *"Want to try that one?"* and opens a ~8s
> reply window needing **no wake word**, reopened after every reply. Inside the window Vector
> responds to **only** a direct answer to its own question or something addressed to it by name —
> **everything else is silence**, because a trainer talking to her rider is not a follow-up and you
> cannot reliably tell the difference. Declined → offer another, no cap, never repeating one
> already offered this session. It ends on acceptance, silence, a stop phrase matched by intent
> (*"stop," "that's enough," "okay Vector," "we're good"* — not a magic string), or the moment the
> trainer starts coaching.
>
> **Grounding — four levels.** Claude generates every reply; **there is no exercise-library table
> and you are not building one.** What changes is the context supplied: (1) this trainer's own
> free-text exercises and homework, from this rider's past sessions **and her other riders'** —
> her method either way, but **strip every trace of which rider it was written for**; (2) other
> opted-in trainers in this rider's own history, inert until that consent exists; (3) a curated,
> welfare-screened corpus of published authorities, cited by person and work — **built ahead of
> time, never live web search**, which is ten times over the latency budget and misattributes; (4)
> general, marked in its first spoken clause. Say once when the grounding drops. **A person's name
> may appear only when `provenance` carries a matching record** — a `sourceSessionId` or a
> `corpusChunkId` with a citation. A name with nothing behind it is a fabricated quote said aloud
> in a recorded session. Rank only on what is in the record — prior prescriptions, whether she's
> ridden it, how she rated that ride, what's already been declined — and **never** on an inference
> about the horse; there is no field for one.
>
> **Provenance is two layers.** Everything Vector says is labelled `vector` in the transcript.
> Spoken and on screen, riders hear the **category** (*"Emma had you doing this in June"* /
> *"Janet Foy writes about this in"* / *"this one's general"*). The **exact record** — source
> session, trainer id, corpus chunk, citation, model and version — is stored and never rendered.
>
> **The rating.** Created at session end, presented as a blocking sheet on next app open. No close
> button, no tap-away, no swipe, no back gesture, nothing pre-selected. Two exits: a number 1–5
> (`1 · a fight` / `5 · effortless`), or `Not now`, which re-presents on every subsequent open
> until answered or 48 hours pass. Then it stops blocking and lives on the ride page. One ride,
> never a queue. Store the value with its scale stamped and never rescale a stored value. This is
> the only blocking sheet in the app.
>
> Write every Vector line, bookends included, to the transcript as a `vector` speaker role
> hard-excluded from trainer attribution, the knowledge base, and model training, keeping
> wake-word utterances and loop replies as normal rider/trainer turns flagged
> `addressedToVector`. Add `VECTOR · ON/OFF` to the session bar with no confirm — it silences
> called turns only, never the bookends. Every failure is silent or one line on screen. Also
> update `CLAUDE.md`: the §3 press-and-hold carve-out, the 1–5 feel scale, and the named
> single-modal exception. Confirm every box in §9 and list anything you stubbed.

---

*Locked 2026-08-14. Amends `CLAUDE.md` § Voice (§3), § Numbers that belong to the rider (§6), and
§ Layout language (§6, the modal exception).*
