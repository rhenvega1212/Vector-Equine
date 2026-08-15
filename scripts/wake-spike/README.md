# Wake-word arena spike (Brief 14 Phase 1)

Throwaway harness for the original go/no-go. **Product called turns now live in CaptureRoom**
via the lesson ASR stream (`src/lib/capture/wake-word.ts` + `called-turn-runtime.ts`).

## Goal (historical)

Custom on-device “Hey Vector” (Porcupine or equivalent) on a phone in a pocket, in an arena, on a horse.

## Product path (current)

- Wake phrase detection on the local SpeechRecognition finals already used for the transcript
  (no separate cloud wake API).
- Earcon → collect to 1.2s silence / 12s cap → `/vector/turn` → shared mix + both screens.
- `VECTOR · ON/OFF` disarms wake only (bookends still play).

Porcupine remains optional hardening if a custom `.ppn` + access key are provisioned later —
do not block called turns on it once the arena gate is go.

## Metrics (record all three)

| Metric | How |
|--------|-----|
| False accepts / ~45 min | Count wakes with no deliberate call |
| Misses / 20 deliberate | Call at walk, trot, canter |
| Gait notes | Behaviour at each |

## Suggested local setup (optional Porcupine)

```bash
# Example with Picovoice Porcupine (bring your own access key + custom keyword)
npm i @picovoice/porcupine-web @picovoice/web-voice-processor
```

Use `scripts/wake-spike/harness.html` only for counter logs on an arena day.
