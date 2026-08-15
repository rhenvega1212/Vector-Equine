-- ============================================================================
-- HORSE PROFILES (rider-owned horses, parent of ride sessions)
-- ============================================================================
CREATE TABLE horse_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  barn_name TEXT,
  breed TEXT,
  age INTEGER,
  birthday DATE,
  sex TEXT,
  height TEXT,
  color TEXT,
  discipline TEXT,
  training_level TEXT,
  owner TEXT,
  rider TEXT,
  trainer TEXT,
  purchase_lease_status TEXT,
  date_acquired DATE,
  notes TEXT,
  profile_photo_url TEXT,
  show_name TEXT,
  personality_quirks TEXT,
  injuries_limitations TEXT,
  goals TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_horse_profiles_user ON horse_profiles(user_id);

ALTER TABLE horse_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own horse profiles"
  ON horse_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_horse_profiles_updated_at
  BEFORE UPDATE ON horse_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ALTER TRAINING_SESSIONS: horse_id, new session types, new fields, new ratings
-- ============================================================================

-- Add horse_id (nullable for legacy sessions; new sessions should set it)
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS horse_id UUID REFERENCES horse_profiles(id) ON DELETE SET NULL;

-- Allow horse to be null when horse_id is set
ALTER TABLE training_sessions ALTER COLUMN horse DROP NOT NULL;

-- Keep existing 'horse' column for legacy display when horse_id is null
CREATE INDEX IF NOT EXISTS idx_training_sessions_horse_id ON training_sessions(horse_id);

-- Session title and structure
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS session_title TEXT;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS location TEXT;

-- Expand session_type: drop old check and add new allowed values
ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS training_sessions_session_type_check;
ALTER TABLE training_sessions ADD CONSTRAINT training_sessions_session_type_check CHECK (
  session_type IN (
    'flat_ride', 'dressage', 'jump_school', 'trail_ride', 'hack', 'lunge', 'groundwork',
    'lesson', 'show', 'conditioning', 'rehab', 'other',
    'ride'  -- legacy
  )
);

-- New quick-rating stats (1-5, optional)
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS ride_quality INTEGER CHECK (ride_quality >= 1 AND ride_quality <= 5);
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS horse_energy INTEGER CHECK (horse_energy >= 1 AND horse_energy <= 5);
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS responsiveness INTEGER CHECK (responsiveness >= 1 AND responsiveness <= 5);
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS balance INTEGER CHECK (balance >= 1 AND balance <= 5);
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS suppleness INTEGER CHECK (suppleness >= 1 AND suppleness <= 5);
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS rider_position INTEGER CHECK (rider_position >= 1 AND rider_position <= 5);
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS rider_effectiveness INTEGER CHECK (rider_effectiveness >= 1 AND rider_effectiveness <= 5);
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS focus INTEGER CHECK (focus >= 1 AND focus <= 5);
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS confidence INTEGER CHECK (confidence >= 1 AND confidence <= 5);
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS progress_today INTEGER CHECK (progress_today >= 1 AND progress_today <= 5);
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS soundness INTEGER CHECK (soundness >= 1 AND soundness <= 5);
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS stamina INTEGER CHECK (stamina >= 1 AND stamina <= 5);
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS behavior_attitude INTEGER CHECK (behavior_attitude >= 1 AND behavior_attitude <= 5);

-- Journal: keep 'notes' as main journal; optional 'exercises' for quick exercises
-- Video: one per session - link or upload
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS video_upload_path TEXT;

-- ============================================================================
-- STORAGE: session videos (one per session, user-scoped)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-videos', 'session-videos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own session videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'session-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own session videos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'session-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own session videos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'session-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own session videos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'session-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Index for listing sessions by horse
CREATE INDEX IF NOT EXISTS idx_training_sessions_user_horse ON training_sessions(user_id, horse_id);

-- ============================================================================
-- STORAGE: horse profile photos
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('horse-photos', 'horse-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Horse photos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'horse-photos');

CREATE POLICY "Users can upload own horse photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'horse-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own horse photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'horse-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own horse photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'horse-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
