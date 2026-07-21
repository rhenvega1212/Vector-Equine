# Social / community flags (brief-09)

Configured in [`src/lib/social/config.ts`](../src/lib/social/config.ts):

| Flag | Default | Purpose |
|---|---|---|
| `SOCIAL_MODE` | `light` | `off` \| `light` \| `full` — dial for community presence |
| `COMMUNITY_ENABLED` | `false` | Gate deeper community (explore depth, etc.) |
| `SHARE_OUTWARD_ENABLED` | `true` | Debrief outward share card + Web Share |

**Active brief-09 work:** outward share on Debrief (9:16 / 1:1 PNG, Web Share + Download).

**Deferred:** further Community demotion / connection-scoped feed / hard-gating Explore. Vector already leads nav; Community stays secondary. Flip flags later without a rebuild.

Vector leads nav; Feed+Explore collapse into **Community** (`/feed`). Explore route kept, not deleted.
