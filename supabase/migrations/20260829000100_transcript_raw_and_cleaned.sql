-- A2a: storage is raw, display is cleaned.
--
-- `text` becomes the verbatim ASR output. `text_cleaned` carries the cleaned
-- rendering used for display and model input. Cleanup and hallucination rules
-- no longer delete rows or rewrite `text`; they set `excluded_from_corpus` and
-- record which rule fired.
--
-- Rows written before this migration have cleaned text in `text` and NULL in
-- `text_cleaned`. Readers fall back to cleaning `text` at read time, which is
-- idempotent, so those rows keep displaying exactly as they did. Their verbatim
-- text is not recoverable — that history is gone and this stops the loss.

ALTER TABLE session_transcript_segments
  ADD COLUMN IF NOT EXISTS text_cleaned TEXT;

COMMENT ON COLUMN session_transcript_segments.text IS
  'Verbatim ASR output. Never overwrite with a cleaned or polished value.';
COMMENT ON COLUMN session_transcript_segments.text_cleaned IS
  'Cleaned rendering for display and model input. NULL means clean text at read time.';

-- Which rule flagged the row, projected out of raw_json so it is queryable
-- rather than only inspectable. Generated, so the two can never disagree.
ALTER TABLE session_transcript_segments
  ADD COLUMN IF NOT EXISTS flag_reason TEXT
  GENERATED ALWAYS AS (raw_json ->> 'exclusion_reason') STORED;

COMMENT ON COLUMN session_transcript_segments.flag_reason IS
  'Rule that flagged this row (NULL = not flagged). Projection of raw_json.exclusion_reason.';

CREATE INDEX IF NOT EXISTS idx_transcript_segments_flag_reason
  ON session_transcript_segments (flag_reason)
  WHERE flag_reason IS NOT NULL;

-- Corpus chokepoint gains both text variants and the flag.
-- Flagged rows carry excluded_from_corpus = true, so they stay out of here.
-- DROP first: CREATE OR REPLACE cannot insert columns in the middle of a view.
DROP VIEW IF EXISTS trainer_corpus_segments;
CREATE VIEW trainer_corpus_segments AS
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
  created_at,
  text_cleaned,
  flag_reason
FROM session_transcript_segments
WHERE speaker <> 'vector'
  AND excluded_from_corpus = false;

COMMENT ON VIEW trainer_corpus_segments IS
  'Brief 14 chokepoint: trainer corpus / polish / KB. Structurally excludes vector speaker and flagged rows.';

-- Answers "how many segments did rule X flag last month, and what were they".
-- Flagging only beats deletion if the false positives can be audited.
CREATE OR REPLACE VIEW transcript_flag_audit AS
SELECT
  s.id,
  s.capture_session_id,
  s.created_at,
  s.speaker,
  s.flag_reason,
  s.text,
  s.raw_json -> 'quality' AS quality
FROM session_transcript_segments s
WHERE s.flag_reason IS NOT NULL;

COMMENT ON VIEW transcript_flag_audit IS
  'Flagged-but-retained speech. Review periodically: a noisy rule silently removes real speech from the corpus.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT ON transcript_flag_audit TO service_role;
  END IF;
END $$;
