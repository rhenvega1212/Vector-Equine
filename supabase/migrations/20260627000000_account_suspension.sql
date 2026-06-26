-- =============================================================================
-- Account suspension + appeal chat
--
--   * Suspension state on profiles (reason / who / when)
--   * suspension_messages: a two-way thread between an admin and the suspended
--     user so they can discuss the reason and request reinstatement
--   * Extends the privilege self-escalation guard so a user can never lift their
--     own suspension via the browser client (service role / admin API bypasses)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Suspension state on profiles
-- ---------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- ---------------------------------------------------------------------------
-- 2. Appeal chat between admin and the suspended user
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suspension_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- the account the thread is about (the suspended user)
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- who wrote this message; nullable so admin deletions don't drop history
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'user')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suspension_messages_user
  ON suspension_messages(user_id, created_at);

-- ---------------------------------------------------------------------------
-- 3. RLS
--    The suspended user may read their own thread and append their own appeal
--    messages. Everything admin-side flows through the service role API.
-- ---------------------------------------------------------------------------
ALTER TABLE suspension_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own suspension thread" ON suspension_messages;
CREATE POLICY "Users read own suspension thread"
  ON suspension_messages FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users append to own suspension thread" ON suspension_messages;
CREATE POLICY "Users append to own suspension thread"
  ON suspension_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() = sender_id
    AND sender_role = 'user'
  );

-- ---------------------------------------------------------------------------
-- 4. Extend privilege self-escalation guard to cover suspension columns
--    (re-creates the function added in the feature-flags migration)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_privilege_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.role := OLD.role;
    NEW.is_beta_tester := OLD.is_beta_tester;
    NEW.trainer_approved := OLD.trainer_approved;
    NEW.trainer_approved_at := OLD.trainer_approved_at;
    NEW.is_suspended := OLD.is_suspended;
    NEW.suspended_at := OLD.suspended_at;
    NEW.suspended_by := OLD.suspended_by;
    NEW.suspension_reason := OLD.suspension_reason;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS profiles_prevent_privilege_self_escalation ON profiles;
CREATE TRIGGER profiles_prevent_privilege_self_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_privilege_self_escalation();
