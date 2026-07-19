# Brief-08 STEP C — Route / component map

| Current | Becomes | Notes |
|---|---|---|
| `/train` Dashboard | **Today** | Loop home |
| `/train/horse` | **Horse room** | Profile · Health · Predict · History |
| `/train/horses/*` | Horse CRUD | Kept; linked from Horse room |
| `/train/sessions` | History lists | Linked from Horse room |
| `/train/sessions/[id]` | **Debrief** | Decoded layout |
| `/train/insights` | Folded into Today + Horse | Route kept, not in Loop nav |
| `/train/ai-trainer/*` | Redirects → `/train/ride/plan/*` | Labels: Plan / Ask Vector |
| `/train/ride/plan` | **Plan** | Start of ride flow |
| `/train/ride/live` | **Live** | Comms shell; sensors gated |
| `api/train/*` | Unchanged | Reused as-is |
