-- Dev schema patch: Capture Live pipeline. Safe to re-run.
-- Run in Supabase SQL Editor if migrations are not auto-applied.

CREATE TABLE IF NOT EXISTS capture_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  horse_id UUID REFERENCES horse_profiles(id) ON DELETE SET NULL,
  training_session_id UUID REFERENCES training_sessions(id) ON DELETE SET NULL,
  join_code TEXT NOT NULL,
  livekit_room TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'live', 'ended')),
  t0 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '4 hours'),
  trainer_display_name TEXT,
  trainer_participant_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT capture_sessions_join_code_unique UNIQUE (join_code)
);

CREATE INDEX IF NOT EXISTS idx_capture_sessions_rider ON capture_sessions(rider_id);
CREATE INDEX IF NOT EXISTS idx_capture_sessions_join_code ON capture_sessions(join_code);
CREATE INDEX IF NOT EXISTS idx_capture_sessions_status ON capture_sessions(status);

CREATE TABLE IF NOT EXISTS session_transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_session_id UUID NOT NULL REFERENCES capture_sessions(id) ON DELETE CASCADE,
  offset_ms INTEGER NOT NULL CHECK (offset_ms >= 0),
  ended_offset_ms INTEGER,
  speaker TEXT NOT NULL CHECK (speaker IN ('rider', 'trainer', 'system')),
  text TEXT NOT NULL,
  confidence REAL,
  raw_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcript_segments_capture
  ON session_transcript_segments(capture_session_id, offset_ms);

CREATE TABLE IF NOT EXISTS session_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_session_id UUID NOT NULL REFERENCES capture_sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('video', 'sensor', 'audio_recording')),
  storage_path TEXT,
  sync_offset_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_capture ON session_media_assets(capture_session_id);

ALTER TABLE capture_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Riders manage own capture sessions" ON capture_sessions;
CREATE POLICY "Riders manage own capture sessions"
  ON capture_sessions FOR ALL
  USING (auth.uid() = rider_id)
  WITH CHECK (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Riders read own transcript segments" ON session_transcript_segments;
CREATE POLICY "Riders read own transcript segments"
  ON session_transcript_segments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM capture_sessions cs
      WHERE cs.id = session_transcript_segments.capture_session_id
        AND cs.rider_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Riders insert own transcript segments" ON session_transcript_segments;
CREATE POLICY "Riders insert own transcript segments"
  ON session_transcript_segments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM capture_sessions cs
      WHERE cs.id = session_transcript_segments.capture_session_id
        AND cs.rider_id = auth.uid()
        AND cs.status IN ('waiting', 'live')
    )
  );

DROP POLICY IF EXISTS "Riders manage own media assets" ON session_media_assets;
CREATE POLICY "Riders manage own media assets"
  ON session_media_assets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM capture_sessions cs
      WHERE cs.id = session_media_assets.capture_session_id
        AND cs.rider_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM capture_sessions cs
      WHERE cs.id = session_media_assets.capture_session_id
        AND cs.rider_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
