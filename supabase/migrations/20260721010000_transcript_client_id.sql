-- Barn WiFi: idempotent transcript segment retries via client_id
ALTER TABLE session_transcript_segments
  ADD COLUMN IF NOT EXISTS client_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transcript_segments_client_id
  ON session_transcript_segments (capture_session_id, client_id)
  WHERE client_id IS NOT NULL;
