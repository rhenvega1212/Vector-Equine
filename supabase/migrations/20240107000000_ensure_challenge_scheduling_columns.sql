-- Ensure challenge scheduling columns exist (fixes "close_at not in schema cache" if 20240104 was not applied)
ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS schedule_type TEXT DEFAULT 'scheduled'
    CHECK (schedule_type IN ('scheduled', 'evergreen')),
  ADD COLUMN IF NOT EXISTS open_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS close_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;
