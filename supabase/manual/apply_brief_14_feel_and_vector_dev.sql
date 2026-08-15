-- Dev apply: Brief 14 feel nullability + vector speaker (same as migration).
-- Run in Supabase SQL editor if migrations are not auto-applied.

ALTER TABLE training_sessions
  ALTER COLUMN overall_feel DROP NOT NULL;

ALTER TABLE training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_overall_feel_check;

ALTER TABLE training_sessions
  ADD CONSTRAINT training_sessions_overall_feel_check
  CHECK (
    overall_feel IS NULL
    OR (overall_feel >= 1 AND overall_feel <= 10)
  );

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS feel_scale SMALLINT
    CHECK (feel_scale IS NULL OR feel_scale IN (5, 10));

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS feel_asked_at TIMESTAMPTZ;

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS feel_answered_at TIMESTAMPTZ;

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS feel_deferrals INTEGER NOT NULL DEFAULT 0;

ALTER TABLE training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_feel_scale_value_ck;

ALTER TABLE training_sessions
  ADD CONSTRAINT training_sessions_feel_scale_value_ck
  CHECK (
    (overall_feel IS NULL AND feel_scale IS NULL)
    OR (overall_feel IS NOT NULL AND feel_scale IS NOT NULL)
  );

UPDATE training_sessions
SET
  feel_scale = 10,
  feel_answered_at = COALESCE(feel_answered_at, updated_at, created_at)
WHERE overall_feel IS NOT NULL
  AND COALESCE(session_source, 'manual') = 'manual'
  AND feel_scale IS NULL;

UPDATE training_sessions
SET
  overall_feel = NULL,
  feel_scale = NULL,
  feel_asked_at = COALESCE(feel_asked_at, created_at),
  feel_answered_at = NULL
WHERE COALESCE(session_source, 'manual') IN ('comms', 'hybrid');

-- Count remaining fabricated-looking 5s on capture sources (should be 0 after update):
-- SELECT count(*) FROM training_sessions
-- WHERE overall_feel = 5 AND session_source IN ('comms','hybrid');

ALTER TABLE session_transcript_segments
  DROP CONSTRAINT IF EXISTS session_transcript_segments_speaker_check;

ALTER TABLE session_transcript_segments
  ADD CONSTRAINT session_transcript_segments_speaker_check
  CHECK (speaker IN ('rider', 'trainer', 'system', 'vector'));

ALTER TABLE session_transcript_segments
  ADD COLUMN IF NOT EXISTS addressed_to_vector BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE session_transcript_segments
  ADD COLUMN IF NOT EXISTS excluded_from_corpus BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION session_transcript_force_vector_exclusion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.speaker = 'vector' THEN
    NEW.excluded_from_corpus := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vector_corpus_exclusion ON session_transcript_segments;
CREATE TRIGGER trg_vector_corpus_exclusion
  BEFORE INSERT OR UPDATE OF speaker, excluded_from_corpus
  ON session_transcript_segments
  FOR EACH ROW
  EXECUTE FUNCTION session_transcript_force_vector_exclusion();

UPDATE session_transcript_segments
SET excluded_from_corpus = true
WHERE speaker = 'vector' AND excluded_from_corpus = false;

CREATE OR REPLACE VIEW trainer_corpus_segments AS
SELECT
  id,
  capture_session_id,
  offset_ms,
  ended_offset_ms,
  speaker,
  text,
  confidence,
  client_id,
  raw_json,
  addressed_to_vector,
  created_at
FROM session_transcript_segments
WHERE speaker <> 'vector'
  AND excluded_from_corpus = false;
