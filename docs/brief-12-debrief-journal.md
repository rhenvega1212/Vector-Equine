# Brief 12 — Debrief journal & Ask Vector

**Goal:** Turn Capture Live into a detailed, branded lesson brief riders reopen, plus grounded Claude chat about the ride.

**Voice:** Coach = Vector. Never print “AI”. Health flagged, never diagnosed.

## Journal modules (live)

1. **Header** — title, horse, **Lesson with {trainer}**, when, duration, source
2. **Today’s focus** — one sentence (not a fake execution score for `comms`)
3. **Lesson story** — multi-paragraph summary from cleaned transcript (trainer quotes woven in)
4. **Coach quotes** — valuable trainer lines in quotation marks → Timeline jump
5. **What you marked** — rider-starred timeline moments folded into the brief
6. **Key work** — exercises / patterns
7. **Homework / next ride**
8. **Ask Vector** — Claude chat grounded in this lesson

## Rider highlight flow

On **Timeline**, star any cue. That toggles `raw_json.rider_highlight` and rewrites the journal’s “What you marked” block inside `summary` (replaceable markers). Journal updates without leaving Debrief.

## Coming soon (architecture visible)

- Your ride, decoded · Aid consistency · Health note · Plan vs ridden · Media strip · Execution score (live only when hybrid/sensor)

## Ask Vector grounding

- Context: transcript segments, brief fields, horse focus
- Cite timestamps when answering from the lesson
- If unsupported: **“I don’t know from this lesson”**
- Claude via AI SDK (`anthropic/claude-sonnet-4.5` through Gateway when configured)

## Identity

- Today: **Welcome back, {firstName}** from `profiles.display_name`
- Lesson cards + brief: trainer name when present

## Ship

P0 = this brief. P1 = wins/watch, reflection, share polish. P2 = fill Coming soon with real data.
