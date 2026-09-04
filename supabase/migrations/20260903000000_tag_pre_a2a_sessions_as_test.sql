-- Pre-A2a captures: tag as test data, do not backfill flags.
--
-- The 1,160 historical transcript rows were written before exclusion_reason
-- was stored. Replaying the current (post-audit) rules onto them would stamp
-- flags that the audit itself retired. is_test is the existing product gate:
-- hidden from Last rides, horse timelines, and the dashboard.
--
-- Cutoff is the A2a migration day (2026-08-29). No live segment existed after
-- 16 Aug 2026 at the time this ran; the date is the contract, not a recount.

UPDATE capture_sessions cs
SET is_test = true
WHERE cs.is_test = false
  AND EXISTS (
    SELECT 1
    FROM session_transcript_segments s
    WHERE s.capture_session_id = cs.id
      AND s.created_at < TIMESTAMPTZ '2026-08-29 00:00:00+00'
  );

UPDATE training_sessions ts
SET is_test = true
WHERE ts.is_test = false
  AND ts.id IN (
    SELECT cs.training_session_id
    FROM capture_sessions cs
    WHERE cs.is_test = true
      AND cs.training_session_id IS NOT NULL
  );

-- Corpus SQL consumers must not pick up those rides either.
DROP VIEW IF EXISTS trainer_corpus_segments;
CREATE VIEW trainer_corpus_segments AS
SELECT
  s.id,
  s.capture_session_id,
  s.offset_ms,
  s.ended_offset_ms,
  s.speaker,
  s.text,
  s.confidence,
  s.client_id,
  s.raw_json,
  s.addressed_to_vector,
  s.created_at,
  s.text_cleaned,
  s.flag_reason
FROM session_transcript_segments s
JOIN capture_sessions c ON c.id = s.capture_session_id
WHERE s.speaker <> 'vector'
  AND s.excluded_from_corpus = false
  AND c.is_test = false;

COMMENT ON VIEW trainer_corpus_segments IS
  'Brief 14 chokepoint: trainer corpus / polish / KB. Excludes vector speaker, flagged rows, and is_test captures.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT ON trainer_corpus_segments TO service_role;
  END IF;
END $$;
