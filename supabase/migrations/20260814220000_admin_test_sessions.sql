-- Admin test lessons: tag capture + durable ride; hide from product lists.

ALTER TABLE capture_sessions
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_capture_sessions_rider_test
  ON capture_sessions (rider_id, is_test);

CREATE INDEX IF NOT EXISTS idx_training_sessions_user_test
  ON training_sessions (user_id, is_test)
  WHERE is_test = false;
