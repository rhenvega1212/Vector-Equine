-- =============================================================================
-- Feature flags, beta cohort, and privilege hardening
--
-- Implements the foundation from the architecture brief:
--   * Beta-tester cohort tag on profiles (closed-beta membership)
--   * feature_flags registry with a stage ladder (off → internal → closed_beta
--     → open_beta → ga) plus a rollout percentage for open beta
--   * feature_flag_overrides for explicit per-user allow/deny (invites & opt-in)
--   * A trigger that prevents riders from self-escalating privileged columns
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Beta cohort tag on profiles
-- ---------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_beta_tester BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- 2. Shared updated_at helper (idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 3. Feature flag registry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'off'
    CHECK (stage IN ('off', 'internal', 'closed_beta', 'open_beta', 'ga')),
  rollout_percentage INT NOT NULL DEFAULT 0
    CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS feature_flags_set_updated_at ON feature_flags;
CREATE TRIGGER feature_flags_set_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Per-user overrides (explicit allow/deny — closed-beta invites, opt-in)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feature_flag_overrides (
  flag_key TEXT NOT NULL REFERENCES feature_flags(key) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (flag_key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_user
  ON feature_flag_overrides(user_id);

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_overrides ENABLE ROW LEVEL SECURITY;

-- Anyone logged in can read the registry; writes are service-role only (admin API).
DROP POLICY IF EXISTS "Feature flags are readable by everyone" ON feature_flags;
CREATE POLICY "Feature flags are readable by everyone"
  ON feature_flags FOR SELECT
  USING (true);

-- Users can read only their own overrides; writes are service-role only.
DROP POLICY IF EXISTS "Users read own flag overrides" ON feature_flag_overrides;
CREATE POLICY "Users read own flag overrides"
  ON feature_flag_overrides FOR SELECT
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. Prevent privilege self-escalation on profiles
--    Riders must not be able to change role / beta / trainer flags on their own
--    row via the browser client. Service role (admin API) bypasses this.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_privilege_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.role := OLD.role;
    NEW.is_beta_tester := OLD.is_beta_tester;
    NEW.trainer_approved := OLD.trainer_approved;
    NEW.trainer_approved_at := OLD.trainer_approved_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS profiles_prevent_privilege_self_escalation ON profiles;
CREATE TRIGGER profiles_prevent_privilege_self_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_privilege_self_escalation();

-- ---------------------------------------------------------------------------
-- 7. Seed the known flags (Bucket 2 features from the brief)
--    training_diary starts at 'internal' so the team keeps current access while
--    it is promoted up the ladder. The rest start 'off'.
-- ---------------------------------------------------------------------------
INSERT INTO feature_flags (key, description, stage) VALUES
  ('training_diary', 'Training diary, horses, sessions & insights (the Train workspace)', 'internal'),
  ('ai_video_analysis', 'AI video analysis of training sessions', 'off'),
  ('ai_highlight_reel', 'AI-generated highlight reels', 'off')
ON CONFLICT (key) DO NOTHING;
