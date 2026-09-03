# Brief 14 — Ops notes

## Kill switch ownership

| Flag | Owner | Effect |
|------|--------|--------|
| `vector_in_session` | Founder (admin Flags panel) | Open / close / called turns. Evaluated from DB at **session start** (via `getFlagsForProfile` / layout), not baked at build. Flip off → next session has no Vector voice. Mid-session flip does not yank an in-flight lesson. |
| `vector_feel_prompt` | Founder (admin Flags panel) | Blocking feel sheet only. Independent of live voice. |

Default stage: `internal` until §9 + measured gates + trainer would-run-again.

## No-wake escape variant

If the arena wake spike is no-go and Phases 2–4 ship alone:

- Do **not** render `◇ SAY "HEY VECTOR"`
- Do **not** render `VECTOR · ON/OFF`
- Open/close bookends still play (capture disclosure)
- Called turns stay off

## Early trainer gate (P4b)

After bookends + feel + channel, before called turns: *did any of that get in your way?*

## Final ship gate (P7)

Two trainers × two paid lessons: *would you run your next lesson with this on?* Two noes → stay `internal`.
