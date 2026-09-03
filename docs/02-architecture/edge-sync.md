# Edge sync — Jetson + master clock (Phases 0–2)

Phone **Start** creates `capture_sessions` + **`t0`** (master clock).  
Jetson **attaches**, records camera video stamped to that `t0`, uploads on complete.  
Transcript stays in the cloud (LiveKit + Whisper) on the same `t0`.  
Debrief plays **native video** with seek-from-transcript.

## Apply schema

```bash
# preferred
supabase db push
# or SQL editor:
# supabase/manual/apply_edge_devices_dev.sql
```

## Pair device (once)

While logged in as the rider:

`POST /api/edge/devices/pair` `{ "label": "Barn Jetson" }`  
→ save `device_key` + `device_secret` on the Jetson.

## Lesson loop

1. Rider: Live → Start  
2. Jetson: `python3 edge/jetson-agent/agent.py` (see README)  
3. Lesson audio/transcript as today  
4. Jetson uploads video → `complete`  
5. Rider: End → polish  
6. Ride page: signed video + transcript timestamps scrub the player  

## APIs

| Route | Who |
|-------|-----|
| `POST /api/edge/devices/pair` | Rider |
| `GET /api/edge/devices/pair` | Rider (list) |
| `POST /api/edge/sessions/attach` | Jetson `Edge key:secret` |
| `POST /api/edge/sessions/:id/heartbeat` | Jetson Bearer session |
| `POST /api/edge/sessions/:id/video` | Jetson Bearer session |
| `POST /api/edge/sessions/:id/complete` | Jetson Bearer session |

## Not in this slice

- Sensor ingest / insights (Phase 3)  
- Live camera preview on phone  
- Chunked signed uploads for multi-GB rides  
