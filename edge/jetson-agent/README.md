# Vector Jetson agent (Phases 0–1)

Phone is the **Start / End** button. This agent attaches to the open lesson, shares the platform `t0` master clock, uploads camera video, then signals complete.

## One-time pair (as the rider, logged into the app)

```bash
# With your session cookie, or via browser Network tab after adding a Lab button later:
curl -X POST http://localhost:3000/api/edge/devices/pair \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{"label":"Barn Jetson"}'
```

Save `device_key` + `device_secret` on the device (secret is shown once).

## Run

```bash
export VECTOR_API_BASE=http://localhost:3000
export EDGE_DEVICE_KEY=...
export EDGE_DEVICE_SECRET=...
export EDGE_VIDEO_PATH=/path/to/lesson.mp4   # optional but recommended

# 1) Rider starts Live on the phone
# 2) Then:
python3 agent.py
# 3) Rider Ends on the phone → debrief plays video + transcript on the same clock
```

## API contract

| Step | Endpoint | Auth |
|------|----------|------|
| Pair | `POST /api/edge/devices/pair` | Rider cookie |
| Attach | `POST /api/edge/sessions/attach` | `Edge key:secret` |
| Heartbeat | `POST /api/edge/sessions/:id/heartbeat` | Bearer session_token |
| Video | `POST /api/edge/sessions/:id/video` | Bearer session_token |
| Complete | `POST /api/edge/sessions/:id/complete` | Bearer session_token |

Master clock = `capture_sessions.t0`. Stamp every frame/sample as `offset_ms` from that instant. Transcript stays in the cloud (LiveKit + Whisper) on the same `t0`.
