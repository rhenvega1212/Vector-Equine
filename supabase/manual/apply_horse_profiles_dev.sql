-- Dev schema patch: horse_profiles + session columns missing on linked project.
-- Run in Supabase Dashboard → SQL Editor (project sbldlebgtonaxtofflnw), then re-run seed.
-- Safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS horse_profiles (
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

CREATE INDEX IF NOT EXISTS idx_horse_profiles_user ON horse_profiles(user_id);
ALTER TABLE horse_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own horse profiles" ON horse_profiles;
CREATE POLICY "Users can manage own horse profiles"
  ON horse_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_horse_profiles_updated_at ON horse_profiles;
    CREATE TRIGGER update_horse_profiles_updated_at
      BEFORE UPDATE ON horse_profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS horse_id UUID REFERENCES horse_profiles(id) ON DELETE SET NULL;
ALTER TABLE training_sessions ALTER COLUMN horse DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_training_sessions_horse_id ON training_sessions(horse_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_user_horse ON training_sessions(user_id, horse_id);

ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS session_title TEXT;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS location TEXT;

ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS training_sessions_session_type_check;
ALTER TABLE training_sessions ADD CONSTRAINT training_sessions_session_type_check CHECK (
  session_type IN (
    'flat_ride', 'dressage', 'jump_school', 'trail_ride', 'hack', 'lunge', 'groundwork',
    'lesson', 'show', 'conditioning', 'rehab', 'other', 'ride'
  )
);

ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS ride_quality INTEGER;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS horse_energy INTEGER;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS responsiveness INTEGER;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS balance INTEGER;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS suppleness INTEGER;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS rider_position INTEGER;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS rider_effectiveness INTEGER;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS focus INTEGER;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS confidence INTEGER;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS progress_today INTEGER;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS soundness INTEGER;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS stamina INTEGER;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS behavior_attitude INTEGER;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS video_upload_path TEXT;

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS session_source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS homework TEXT;

NOTIFY pgrst, 'reload schema';
