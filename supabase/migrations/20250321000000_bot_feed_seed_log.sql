-- One row per calendar day (America/New_York in app) after a successful bot seed run.
-- Used for idempotency and backfill of missing days.

CREATE TABLE IF NOT EXISTS bot_feed_seed_log (
  seed_date DATE PRIMARY KEY,
  post_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_feed_seed_log_created_at
  ON bot_feed_seed_log (created_at DESC);

ALTER TABLE bot_feed_seed_log ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated cannot access; service_role bypasses RLS.

COMMENT ON TABLE bot_feed_seed_log IS 'Tracks successful daily bot post seeds for idempotency and backfill.';
