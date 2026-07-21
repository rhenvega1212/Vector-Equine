-- Brief 10: Vector first-run setup baseline (rider + horse + pair + light health)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS vector_setup_completed_at TIMESTAMPTZ;

ALTER TABLE horse_profiles
  ADD COLUMN IF NOT EXISTS months_together INTEGER,
  ADD COLUMN IF NOT EXISTS sessions_per_week INTEGER,
  ADD COLUMN IF NOT EXISTS current_focus TEXT,
  ADD COLUMN IF NOT EXISTS sticking_points TEXT,
  ADD COLUMN IF NOT EXISTS health_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS health_flag_notes TEXT,
  ADD COLUMN IF NOT EXISTS baseline_completed_at TIMESTAMPTZ;

-- Existing riders who already have a horse skip the wizard.
UPDATE profiles
SET vector_setup_completed_at = COALESCE(vector_setup_completed_at, NOW())
WHERE vector_setup_completed_at IS NULL
  AND id IN (SELECT DISTINCT user_id FROM horse_profiles);

-- Coach-only accounts never need the horse wizard.
UPDATE profiles
SET vector_setup_completed_at = COALESCE(vector_setup_completed_at, NOW())
WHERE vector_setup_completed_at IS NULL
  AND role_trainer = TRUE
  AND role_rider = FALSE;

NOTIFY pgrst, 'reload schema';
