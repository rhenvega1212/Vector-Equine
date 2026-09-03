# Brief 10 — First-run Vector setup (hard gate)

Keep The Loop (`Today → Plan → Live → Debrief`, Horse room). Before the Loop opens, riders complete a **setup wizard** that stores a baseline for Vector models.

## Flow

1. Account onboarding (`/onboarding`) — username, display name, roles.
2. **Vector setup** (`/train/setup`) — hard-gated for `role_rider` until `profiles.vector_setup_completed_at` is set.
3. Empty Loop — no demo horse/sessions (Dean is seed/docs only).

Coach-only (`role_trainer && !role_rider`) skips the wizard; onboarding sets `vector_setup_completed_at`.

## Wizard steps

| Step | Fields | Storage |
|------|--------|---------|
| Rider | discipline, rider_level | `profiles` |
| Horse | name, breed, age, sex, discipline, training_level, goals, injuries_limitations | `horse_profiles` |
| Pair | months_together, sessions_per_week, current_focus, sticking_points | `horse_profiles` |
| Health | health_flags[], health_flag_notes | `horse_profiles` (flags only — not a diagnosis) |

API: `POST /api/train/setup` creates the horse and stamps completion.

## Gate

- Middleware: riders without `vector_setup_completed_at` are redirected to `/train/setup` for all `/train/*` except setup itself.
- Train layout mirrors the same rule via `x-pathname`.
- Loop bottom nav is hidden on `/train/setup`.
- Migration backfills completion for accounts that already have a horse.

## Model context (store now, consume later)

Plan / Ask Vector should eventually read:

- `profiles.discipline`, `profiles.rider_level`
- Active horse core + pair + `health_flags`

Wiring into prompts is a follow-up once Plan chat is real; this brief only **stores** the baseline.

## Dev schema

If migrations are not auto-applied locally, run:

`supabase/manual/apply_vector_setup_baseline_dev.sql`
