# Vector — UX Foundation

**The reference doc for the app's core product section.** Everything (prototype, briefs, the
eventual build) should trace back to this. Written 2026-07-14. Companion artifacts: the visual
IA + flow map (`vector-ia-map.html`) and the clickable prototype (`vector-prototype.html`).

Related decisions: `VE-decision-rider-trainer-model.md` (who pays), `brief-07-*` (profile/roles),
`brief-06-train-tab-prototype.md` (the earlier Train prototype this widens).

---

## 1. What this section is (and why we renamed it)

The section formerly called **Train** now does three jobs:

- **Train** — feel and timing in the moment (real-time aid coaching).
- **Health** — training load, recovery, and soundness *flags* over time.
- **Predict** — what's coming: readiness, patterns, and risk before it's obvious.

"Train" only named the first. The new name is **Vector** — it doubles as the name of the
intelligence, so a rider literally *"checks Vector"* or *"asks Vector,"* and it lets us describe
the smarts without ever saying the word "AI" (a hard brand rule). From here on, the tab formerly
called Train is **Vector**.

---

## 2. The core idea that keeps it simple

Three jobs is a lot to put in front of a rider. The way we keep it from overwhelming is to **not
organize the app around the three jobs.** We organize around the two nouns a rider already lives in:

- **The ride** — what I'm doing today. *(Training lives here: plan → ride → debrief.)*
- **My horse** — who I'm doing it with, over time. *(Health and prediction live here — they're
  only meaningful as trends across many rides.)*

Training is a **moment**; health and prediction are a **timeline.** Everything in Vector slots
into one of those two. That single split is the backbone of the whole experience.

---

## 3. The profiles / entities

Three first-class entities. Two are people; one is the horse.

**Rider** *(user, always pays)* — the subject of sessions; owns horses; generates the data.
**Trainer / Coach** *(user, free)* — connects to riders, coaches, never captured unless they ride.
**Horse** *(not a user — an object)* — **the anchor everything attaches to.** Every ride, flag,
and prediction hangs off a horse, not off the rider. A rider can have several horses.

> Design consequence: the **horse is a profile too**, with its own page (age, breed, level, goals)
> and its own timeline (health, load, prediction, history). Much of "what goes where" falls out of
> this: anything that accrues *over time* belongs to the horse; anything that happens *today*
> belongs to the ride.

Future entities (not in MVP): **Barn** (groups horses/riders; shared hardware), **Vet** (a
read-only window into the health/prediction flags — a natural extension of "flags for your vet").

---

## 4. What goes where (the pieces)

Regardless of how we arrange the navigation, these are the pieces and where they belong:

**The ride (a moment / a flow):**
- *Plan* — tell Vector the goal, get exercises + a visual. (Optional; you can just ride.)
- *Live Ride* — comms with your trainer + live aid "sweet spot" feedback (if sensors) + the
  headset view.
- *Debrief* — the ride decoded: scored, moments flagged, session summary, homework. **A
  comms-only rider (no sensors) still gets the summary + homework here** — that's the CeeCoach
  replacement value.

**The horse (a timeline):**
- *Profile* — age, breed, level, goals, history.
- *Health* — training load, recovery, symmetry — all calm *flags*, never diagnosis.
- *Predict* — readiness, patterns, "needs a lighter week" — forward-looking.

**The rider (light):**
- *Progress* — your own improvement (aid consistency climbing). Small; can live on the home.

**Plumbing (tucked away):**
- *Setup* — pair sensors, manage your coach connection + subscription.

---

## 5. The two architectures under test

The pieces are the same; the question is how they're **arranged** and what the rider sees first.
The prototype builds both so we can feel the difference before committing.

### Option 1 — "The Loop" (action-first) — recommended spine
Two rooms — **Today** and **Horse** — and the ride is a *flow you launch,* not a tab you sit in.
Today answers "what are we doing?" with a big Start button and the day's status; Horse is the
"over time" room (health + predict + history in one place).
*Best for the one-or-two-horse amateur (our core user). Grows into horse-switching later without
a rebuild.*

### Option 3 — "Horse-first" (object-first)
You're always *inside a horse*; ride, health, and predict are peer sub-tabs of that horse, behind
a horse selector.
*Best for multi-horse pros and barns; makes the horse the hero. Costs a step before "ride now."*

*(Option 2, "Three Rooms" — Home · Ride · Horse as fixed tabs — is the middle ground; not
prototyped, but easy to reach from Option 1 if we want more explicit addresses.)*

---

## 6. The flow of usage

### First time (onboarding) — keep it to the essentials
1. Sign up → **pick role** (I ride / I coach / both).
2. **Create your horse** — the anchor step (name, age, breed, discipline, level, goal).
3. *(Optional)* **Connect your trainer** — invite link.
4. **How will you ride today?** — just comms, or with sensors. (Sets expectations; no hardware
   required to start.)
5. Land on the home (Today / the horse overview).

### Every day after — the loop
Open → **home shows today** (horse status, one flag if any, suggested focus) → **Start** →
*(optional)* **Plan** the goal → **Ride** (comms + live aids) → **Debrief** (summary + homework) →
…and quietly, that ride **feeds the horse's timeline**, so health and prediction get smarter with
zero extra effort.

> The one sentence that captures the design: **the rider only ever does the loop
> (ride → debrief); health and prediction are the payoff that accrues on its own.** They never
> "go do health" — it shows up.

---

## 7. The principle that prevents overwhelm

**Progressive disclosure — show one next action; reveal depth as data arrives.**

- A brand-new comms-only rider sees almost nothing: *"Start a lesson,"* then *"here's your
  summary."* No empty dashboards, no charts with no data.
- As rides accumulate and sensors get added, the horse timeline, the decoded aid feedback, and
  predictions unlock. **The app grows with the rider** instead of dumping everything on day one.
- This applies at the architecture level too: start people in the simple "Loop," and let the
  experience graduate toward more structure (horse-switching, deeper analytics) only when they
  have the horses and data to need it.

Design rules that follow from this:
- Never show an empty module — hide it until there's something in it, or show a single
  invitation instead.
- One primary action per screen. Everything else is secondary.
- Language stays rider-native and calm; the intelligence is felt, never announced ("Vector,"
  never "AI"); health is flagged, never diagnosed; Vector always assists, never replaces the
  trainer.

---

## 8. Build approach

**Design → prototype → evolve** (not rebuild). The existing Cursor-built app has working
plumbing (auth, payments, social) worth keeping. The path:

1. **Design** — this doc + the IA map. *(done)*
2. **Prototype** — the clickable phone prototype (Loop vs Horse-first) to see and choose. *(this round)*
3. **Choose** — pick the architecture; lock naming/flows.
4. **Evolve** — briefs for Cursor to restructure the current section into the chosen shape,
   screen by screen, reusing existing components where possible.

---

## 9. Open questions

- Which architecture wins (Loop vs Horse-first) — decide from the prototype.
- Does "Progress" (rider improvement) live on the home, inside Horse, or as its own small room?
- Where does the **coach relationship** surface inside Vector vs on the Profile tab (see brief-07)?
- Naming inside the section: do we keep "Today / Horse," or use warmer labels?
- When (if ever) do we expose the Barn/Vet views that the health + prediction data invite?
