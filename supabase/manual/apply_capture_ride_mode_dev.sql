-- Dev apply: solo vs with-trainer ride mode (safe to re-run)
ALTER TABLE capture_sessions
  ADD COLUMN IF NOT EXISTS ride_mode text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'capture_sessions_ride_mode_check'
  ) THEN
    ALTER TABLE capture_sessions
      ADD CONSTRAINT capture_sessions_ride_mode_check
      CHECK (ride_mode IS NULL OR ride_mode IN ('solo', 'with_trainer'));
  END IF;
END $$;
