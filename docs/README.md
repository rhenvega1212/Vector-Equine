# Vector Equine — Documentation

Start here. This folder is ordered by **why you'd open it**, not by when it was written.

| Folder | What's in it | Is it current? |
|--------|--------------|----------------|
| [`01-foundations/`](./01-foundations) | Brand tokens and UX rules. Applies to every screen. | **Always current.** Treat as law. |
| [`02-architecture/`](./02-architecture) | How the system works and where it's going. | **Current.** Read before designing anything. |
| [`03-build/`](./03-build) | Work in flight. Briefs being built right now. | **Current.** This is the active queue. |
| [`04-briefs/`](./04-briefs) | Numbered build briefs 02–14, in order. Historical record of shipped work. | **Mostly shipped.** Accurate about intent, not always about the code today. |
| [`05-ops/`](./05-ops) | Deployment and Stripe runbooks. | Current. |
| [`99-archive/`](./99-archive) | Superseded. Kept for history only. | **Do not follow.** |

The root [`CLAUDE.md`](../CLAUDE.md) holds the standing repo rules — language constraints, brand
tokens, layout language. It is loaded automatically by the coding agents and it outranks anything
in this folder.

---

## If you're new, read these four, in this order

1. **[`../CLAUDE.md`](../CLAUDE.md)** — the rules. Non-negotiable ones about language and layout.
   Fifteen minutes, and it will save you a rewrite.
2. **`02-architecture/Vector-Equine-Platform-Architecture.docx`** — what the product actually is.
   Three tiers, one session object, and why the tiers exist.
3. **[`01-foundations/vector-ux-foundation.md`](./01-foundations/vector-ux-foundation.md)** — how
   screens are supposed to feel, and the two-voices rule that keeps coaching separate from measurement.
4. **[`02-architecture/edge-sync.md`](./02-architecture/edge-sync.md)** — how the hardware attaches
   to a session. Short.

Then find the brief for whatever you've been handed, in `03-build/` if it's active or `04-briefs/`
if it shipped.

---

## The architecture documents

In `02-architecture/`:

| Document | What it settles |
|----------|-----------------|
| `Vector-Equine-Platform-Architecture.docx` | The three tiers, the invariants that hold across all of them, and the open decisions. **The primary reference.** |
| `edge-sync.md` | The capture loop between phone, device and cloud. Phases 0–2 and what's explicitly out of scope. |
| `transcript-pipeline.md` | Raw storage versus cleaned display, the flag rules and how to audit them, and where lesson audio lives. **Read before touching transcripts.** |
| `reviews/Vector-Equine-Phone-as-Remote-Edge-Plan.docx` | What it takes to run the device headless, controlled from the phone. Gap analysis and phasing. |
| `reviews/Vector-Equine-Architecture-Review-Response.docx` | Code-verified review of the platform architecture. Nine findings, four open questions. **Read alongside the architecture memo — it corrects it in places.** |

Two areas have their detail in the brief series rather than here, because the briefs are still the
best description of them:

- **Capture pipeline** — `04-briefs/brief-11-capture-pipeline.md`
- **Vector during a session** (wake word, called turns) — `04-briefs/brief-14-vector-in-the-session.md`

---

## Active work

In `03-build/`:

| Document | Status |
|----------|--------|
| `BUILD-A-transcription-quality.md` | The brief. Milestone 1, Section A. |
| `Build-A-Transcription-Audit-and-Plan.docx` | A1 audit complete, with a revised task order and four open decisions. **Read this before writing Section A code** — it changes the sequence in the brief. |

---

## Reading the brief series

`04-briefs/` is a numbered series, oldest first. Useful context, but they describe intent at the
time of writing — where a brief and the code disagree, the code won. Briefs 01 and 05 don't exist.

Three of them have companion files, which is why the numbering looks doubled:

- Brief 08 — `brief-08-vector-restructure.md` (the brief), `plan-brief-08-vector-loop.md` (the plan),
  `brief-08-route-map.md` (route map)
- Brief 14 — `brief-14-vector-in-the-session.md` (the brief), `VE-brief-14-build-plan.md` (the plan),
  `brief-14-ops.md` (ops notes)
- `social-flags.md` belongs to brief 09

The most load-bearing ones for current work:

| Brief | Why you'd read it |
|-------|-------------------|
| `brief-07-profile-roles-connections.md` | Rider/trainer roles, connections, share scopes. The permission model still works this way. |
| `brief-11-capture-pipeline.md` | The capture data model. Sessions, transcript segments, media assets. |
| `brief-13-rider-first-five-and-scan-in-claim.md` | Trainer scan-in and the claim flow. |
| `brief-14-vector-in-the-session.md` | Wake word, called turns, the corpus rules. Long, and the reference for anything touching Vector during a ride. |

---

## Conventions for adding documents

- **Architecture goes in `02-architecture/`.** If it describes how the system works today or should
  work, it belongs there — not in a new brief.
- **A brief is a unit of work, not a description of the system.** New briefs go in `03-build/` while
  active, then move to `04-briefs/` when shipped.
- **Never edit a shipped brief to match new reality.** Write the new thing and let the old brief
  stand as a record. Superseded documents move to `99-archive/`.
- **Say what's stale.** A document nobody trusts is worse than no document. If you find something
  wrong, either fix it or add a line at the top saying what's wrong.
