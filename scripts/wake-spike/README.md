# Wake-word arena spike (Brief 14 Phase 1)

Throwaway harness — **not product code**. Measure go/no-go before building called turns.

## Goal

Custom on-device “Hey Vector” (Porcupine or equivalent) on a phone in a pocket, in an arena, on a horse.

## Metrics (record all three)

| Metric | How |
|--------|-----|
| False accepts / ~45 min | Count wakes with no deliberate call |
| Misses / 20 deliberate | Call at walk, trot, canter |
| Gait notes | Behaviour at each |

## Gate

Go/no-go on wake as primary input. **No-go → reopen §5 (headset); ship bookends + feel with no-wake UI (no strip / no ON-OFF).**

## Suggested local setup

```bash
# Example with Picovoice Porcupine (bring your own access key + custom keyword)
npm i @picovoice/porcupine-web @picovoice/web-voice-processor
```

Use `scripts/wake-spike/harness.html` in a phone browser over HTTPS (or localhost tunnels). Do not wire this into CaptureRoom until the spike passes.

## Same trip as Phase 4

Record mixed-channel VAD / barge-in on the same arena day when possible.
