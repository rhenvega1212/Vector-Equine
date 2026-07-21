# Brief 12 — Debrief journal & Ask Vector

**Goal:** Turn Capture Live into a detailed, branded lesson brief riders reopen, plus grounded Claude chat about the ride.

**Voice:** Coach = Vector. Never print “AI”. Health flagged, never diagnosed.

## Journal modules (live)

1. **Header** — title, horse, **Lesson with {trainer}**, when, duration, source
2. **Today’s focus** — one sentence (not a fake execution score for `comms`)
3. **Lesson story** — multi-paragraph / bullet summary from transcript
4. **Coach cue reel** — timestamped trainer quotes → Timeline jump
5. **Key work** — exercises / patterns
6. **Homework / next ride**
7. **Ask Vector** — Claude chat grounded in this lesson

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
