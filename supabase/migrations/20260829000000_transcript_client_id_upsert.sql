-- Transcript segment inserts become upserts so one duplicate client_id cannot
-- discard a whole batch of speech.
--
-- PostgREST's on_conflict only names columns, and Postgres cannot infer a
-- PARTIAL unique index from a bare ON CONFLICT (cols). The predicate is
-- replaced with the default NULLS DISTINCT behaviour, which is equivalent
-- here: rows with a NULL client_id never conflict with each other.

CREATE UNIQUE INDEX IF NOT EXISTS uq_transcript_segments_session_client
  ON session_transcript_segments (capture_session_id, client_id);

DROP INDEX IF EXISTS idx_transcript_segments_client_id;

COMMENT ON INDEX uq_transcript_segments_session_client IS
  'Idempotent segment retries. Non-partial so ON CONFLICT (capture_session_id, client_id) can infer it.';
