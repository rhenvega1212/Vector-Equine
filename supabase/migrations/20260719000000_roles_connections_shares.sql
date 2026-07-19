-- =============================================================================
-- Brief-07 STEP A: roles, coach connections, invites, shares, session fields
-- Additive only — does not change screens.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A1. profiles — role fields (booleans so dual-hat is native)
-- Existing profiles.role enum stays for admin; these are the product roles.
-- ---------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role_rider BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS role_trainer BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trainer_bio TEXT,
  ADD COLUMN IF NOT EXISTS trainer_business BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- A2. coach_connections — rider ↔ trainer link
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coach_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'declined', 'removed')),
  initiated_by TEXT NOT NULL CHECK (initiated_by IN ('rider', 'trainer')),
  share_scope TEXT NOT NULL DEFAULT 'shared_only'
    CHECK (share_scope IN ('all', 'shared_only')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rider_id, trainer_id),
  CHECK (rider_id <> trainer_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_connections_rider ON coach_connections(rider_id);
CREATE INDEX IF NOT EXISTS idx_coach_connections_trainer ON coach_connections(trainer_id);
CREATE INDEX IF NOT EXISTS idx_coach_connections_status ON coach_connections(status);

ALTER TABLE coach_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants read own coach connections" ON coach_connections;
CREATE POLICY "Participants read own coach connections"
  ON coach_connections FOR SELECT
  USING (auth.uid() = rider_id OR auth.uid() = trainer_id);

DROP POLICY IF EXISTS "Participants insert coach connections" ON coach_connections;
CREATE POLICY "Participants insert coach connections"
  ON coach_connections FOR INSERT
  WITH CHECK (auth.uid() = rider_id OR auth.uid() = trainer_id);

DROP POLICY IF EXISTS "Participants update own coach connections" ON coach_connections;
CREATE POLICY "Participants update own coach connections"
  ON coach_connections FOR UPDATE
  USING (auth.uid() = rider_id OR auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = rider_id OR auth.uid() = trainer_id);

CREATE TRIGGER update_coach_connections_updated_at
  BEFORE UPDATE ON coach_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- A3. connection_invites — invite codes/links
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connection_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invite_role TEXT NOT NULL CHECK (invite_role IN ('rider', 'trainer')),
  code TEXT NOT NULL UNIQUE,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'accepted', 'expired')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connection_invites_inviter ON connection_invites(inviter_id);
CREATE INDEX IF NOT EXISTS idx_connection_invites_code ON connection_invites(code);

ALTER TABLE connection_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inviters manage own invites" ON connection_invites;
CREATE POLICY "Inviters manage own invites"
  ON connection_invites FOR ALL
  USING (auth.uid() = inviter_id)
  WITH CHECK (auth.uid() = inviter_id);

-- Anyone authenticated can read an open invite by code (accept flow)
DROP POLICY IF EXISTS "Authenticated read open invites" ON connection_invites;
CREATE POLICY "Authenticated read open invites"
  ON connection_invites FOR SELECT
  USING (status = 'open' AND (expires_at IS NULL OR expires_at > NOW()));

-- ---------------------------------------------------------------------------
-- A4. session_shares — per-session sharing when share_scope = shared_only
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, trainer_id)
);

CREATE INDEX IF NOT EXISTS idx_session_shares_session ON session_shares(session_id);
CREATE INDEX IF NOT EXISTS idx_session_shares_trainer ON session_shares(trainer_id);

ALTER TABLE session_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Riders manage shares of own sessions" ON session_shares;
CREATE POLICY "Riders manage shares of own sessions"
  ON session_shares FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM training_sessions s
      WHERE s.id = session_shares.session_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM training_sessions s
      WHERE s.id = session_shares.session_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Trainers read shares for them" ON session_shares;
CREATE POLICY "Trainers read shares for them"
  ON session_shares FOR SELECT
  USING (auth.uid() = trainer_id);

-- ---------------------------------------------------------------------------
-- A5. share_links — anonymous view-only links
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_links_session ON share_links(session_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);

ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creators manage own share links" ON share_links;
CREATE POLICY "Creators manage own share links"
  ON share_links FOR ALL
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Public read of non-revoked, non-expired links (token lookup via service or anon)
-- Restrict SELECT to creators for client; token route will use service role / RPC later.
-- Allow authenticated creators only here; anonymous access is via API with service role.

-- ---------------------------------------------------------------------------
-- A6. training_sessions — session_source + coaching fields
-- ---------------------------------------------------------------------------
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS session_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (session_source IN ('manual', 'comms', 'sensor', 'hybrid')),
  ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS homework TEXT;

CREATE INDEX IF NOT EXISTS idx_training_sessions_trainer ON training_sessions(trainer_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_source ON training_sessions(session_source);

-- Trainers with an active connection may read shared sessions
DROP POLICY IF EXISTS "Trainers read shared training sessions" ON training_sessions;
CREATE POLICY "Trainers read shared training sessions"
  ON training_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM coach_connections c
      WHERE c.trainer_id = auth.uid()
        AND c.rider_id = training_sessions.user_id
        AND c.status = 'active'
        AND (
          c.share_scope = 'all'
          OR EXISTS (
            SELECT 1 FROM session_shares ss
            WHERE ss.session_id = training_sessions.id
              AND ss.trainer_id = auth.uid()
          )
        )
    )
  );

-- Trainers may update coaching artifacts (summary/homework) on readable sessions
DROP POLICY IF EXISTS "Trainers update coaching fields on shared sessions" ON training_sessions;
CREATE POLICY "Trainers update coaching fields on shared sessions"
  ON training_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM coach_connections c
      WHERE c.trainer_id = auth.uid()
        AND c.rider_id = training_sessions.user_id
        AND c.status = 'active'
        AND (
          c.share_scope = 'all'
          OR EXISTS (
            SELECT 1 FROM session_shares ss
            WHERE ss.session_id = training_sessions.id
              AND ss.trainer_id = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_connections c
      WHERE c.trainer_id = auth.uid()
        AND c.rider_id = training_sessions.user_id
        AND c.status = 'active'
    )
  );
