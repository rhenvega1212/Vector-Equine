-- Standalone: allow claiming coaches to read the training_session (+ transcript)
-- they taught via capture_sessions.trainer_id. Safe to re-run.
-- Apply if you already ran apply_capture_trainer_claim_dev.sql before this existed.

CREATE OR REPLACE FUNCTION public.trainer_can_access_session(
  session_uuid UUID,
  session_owner UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_connections c
    WHERE c.trainer_id = auth.uid()
      AND c.rider_id = session_owner
      AND c.status = 'active'
      AND (
        c.share_scope = 'all'
        OR EXISTS (
          SELECT 1 FROM public.session_shares ss
          WHERE ss.session_id = session_uuid
            AND ss.trainer_id = auth.uid()
        )
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.capture_sessions cs
    WHERE cs.training_session_id = session_uuid
      AND cs.trainer_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Trainers read transcript of lessons they taught" ON session_transcript_segments;
CREATE POLICY "Trainers read transcript of lessons they taught"
  ON session_transcript_segments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.capture_sessions cs
      WHERE cs.id = session_transcript_segments.capture_session_id
        AND cs.trainer_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
