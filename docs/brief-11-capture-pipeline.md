# Brief 11 — Capture Live (data collection pipeline)

Turns a lesson into a **timestamped transcript + customer journal**, with schema ready for later video/sensor sync.

## Locked product decisions

- Guest trainer **scan-and-join** at `/join/{code}` — no Vector account
- **Two-way** audio (LiveKit when `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` are set)
- Debrief tabs: **Journal | Timeline**
- Builder **Lab** at `/train/lab` (`VECTOR_CONFIG.CAPTURE_LAB`)

## Flow

1. Rider: Today → Plan → **Live** → `POST /api/capture/sessions` (join code + QR)
2. Trainer: open `/join/CODE` → name + mic → two-way room
3. Both: browser speech recognition posts `session_transcript_segments` with `offset_ms` from `t0`
4. Rider: **End lesson** → journal `training_sessions` (`session_source: comms`) + Debrief
5. Lab: export JSON (`t0`, segments, empty `media[]` / `sensors[]`)

## Schema

Apply [`supabase/migrations/20260721000000_capture_pipeline.sql`](../supabase/migrations/20260721000000_capture_pipeline.sql) or manual [`apply_capture_pipeline_dev.sql`](../supabase/manual/apply_capture_pipeline_dev.sql). For barn-WiFi idempotent retries, also apply [`apply_transcript_client_id_dev.sql`](../supabase/manual/apply_transcript_client_id_dev.sql).

Tables: `capture_sessions`, `session_transcript_segments` (optional `client_id`), `session_media_assets`.

## Env

```bash
# From LiveKit Cloud → Project → Settings → Keys
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
# optional
NEXT_PUBLIC_LIVEKIT_URL=   # same as LIVEKIT_URL if needed
CAPTURE_JOIN_SECRET=       # optional; falls back to LiveKit/service secrets
SUPABASE_SERVICE_ROLE_KEY= # required for guest join
```

Restart `npm run dev` after setting these. On Live / Join, tap **Start headset call** (mic + headphones, echo cancel on).

Without LiveKit, join + transcript still work; call button explains missing env.

## Barn WiFi (web stage)

Capture Live is built for flaky barn networks:

- **Call** auto-reconnects (fresh LiveKit token) when the radio drops or the phone sleeps
- **Transcript cues** queue on-device (`sessionStorage` outbox + `client_id` idempotency) and flush when online / after reconnect
- **End lesson** flushes the outbox, then retries `POST /end` so the journal is not silently empty
- Timeline poll uses `?after_offset_ms=` once the client has data (less bandwidth on long lessons)
- UI shows offline / queued / weak-link tips — not a dead screen

Apply [`apply_transcript_client_id_dev.sql`](../supabase/manual/apply_transcript_client_id_dev.sql) (or migration `20260721010000_transcript_client_id.sql`) so retries stay duplicate-safe.

This is **not** full offline WebRTC. Keep the screen on when possible; speech recognition still pauses when the tab is backgrounded.

## Dean clean slate

[`supabase/manual/wipe_rider_for_dean_reentry.sql`](../supabase/manual/wipe_rider_for_dean_reentry.sql) — uncomment, set your user id, run, then `/train/setup`.

## Out of scope (P0)

Sensor ingest, auto video align, requiring trainer accounts for live join.
