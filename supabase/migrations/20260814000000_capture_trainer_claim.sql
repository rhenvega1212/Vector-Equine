-- Ship GA: active horse selection, trainer claim fields, feature flags, initiated_by=capture

-- profiles.active_horse_id — selected horse for home hero / Live default
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS active_horse_id UUID REFERENCES horse_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_active_horse ON profiles(active_horse_id);

-- capture_sessions claim bridge (guest trainer → account)
ALTER TABLE capture_sessions
  ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claim_token TEXT,
  ADD COLUMN IF NOT EXISTS claim_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_capture_sessions_claim_token
  ON capture_sessions(claim_token)
  WHERE claim_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_capture_sessions_trainer_id
  ON capture_sessions(trainer_id)
  WHERE trainer_id IS NOT NULL;

-- coach_connections.initiated_by includes capture flywheel
ALTER TABLE coach_connections DROP CONSTRAINT IF EXISTS coach_connections_initiated_by_check;
ALTER TABLE coach_connections
  ADD CONSTRAINT coach_connections_initiated_by_check
  CHECK (initiated_by IN ('rider', 'trainer', 'capture'));

-- Feature flags: rename ai_* keys + seed ship flags
UPDATE feature_flags SET key = 'video_analysis', description = 'Plan / uploaded video analysis'
  WHERE key = 'ai_video_analysis';
UPDATE feature_flags SET key = 'highlight_reel', description = 'Generated highlight reels'
  WHERE key = 'ai_highlight_reel';

INSERT INTO feature_flags (key, description, stage, rollout_percentage)
VALUES
  ('sensor_capture', 'Sensor-derived aid reads, decoded moments, sweet-spot UI', 'off', 0),
  ('horse_health', 'Load, recovery, symmetry — horse health surface', 'off', 0),
  ('events_shows', 'Events and shows', 'off', 0),
  ('trainer_business', 'Trainer Business back-office SKU (never gates coaching)', 'off', 0),
  ('coach_claim', 'Guest trainer claim after scan-in lesson', 'ga', 100),
  ('clinic_batch', 'Clinic multi-lesson claim batch screen', 'internal', 0),
  ('video_analysis', 'Plan / uploaded video analysis', 'off', 0),
  ('highlight_reel', 'Generated highlight reels', 'off', 0)
ON CONFLICT (key) DO NOTHING;

-- Coach can always read capture sessions they taught (trainer_id = auth.uid())
DROP POLICY IF EXISTS "Trainers read capture sessions they taught" ON capture_sessions;
CREATE POLICY "Trainers read capture sessions they taught"
  ON capture_sessions FOR SELECT
  USING (trainer_id = auth.uid());

-- Taught lesson is readable immediately on claim (§10.4) — extend SECURITY DEFINER helper
-- used by training_sessions RLS so we don't reintroduce session_shares recursion.
CREATE OR REPLACE FUNCTION public.trainer_can_access_session(
  session_uuid UUID,
  session_owner UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_connections c
    WHERE c.trainer_id = auth.uid()
      AND c.rider_id = session_owner
      AND c.status = 'active'
      AND (
        c.share_scope = 'all'
        OR EXISTS (
          SELECT 1 FROM public.session_shares ss
          WHERE ss.session_id = session_uuid
            AND ss.trainer_id = auth.uid()
        )
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.capture_sessions cs
    WHERE cs.training_session_id = session_uuid
      AND cs.trainer_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Trainers read transcript of lessons they taught" ON session_transcript_segments;
CREATE POLICY "Trainers read transcript of lessons they taught"
  ON session_transcript_segments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.capture_sessions cs
      WHERE cs.id = session_transcript_segments.capture_session_id
        AND cs.trainer_id = auth.uid()
    )
  );
