-- Fix infinite recursion: training_sessions ↔ session_shares RLS
-- session_shares policies queried training_sessions, whose trainer policies
-- queried session_shares again (INSERT … RETURNING / SELECT).

CREATE OR REPLACE FUNCTION public.owns_training_session(session_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.training_sessions s
    WHERE s.id = session_uuid AND s.user_id = auth.uid()
  );
$$;

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
  );
$$;

REVOKE ALL ON FUNCTION public.owns_training_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_training_session(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.trainer_can_access_session(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trainer_can_access_session(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Riders manage shares of own sessions" ON session_shares;
CREATE POLICY "Riders manage shares of own sessions"
  ON session_shares FOR ALL
  USING (public.owns_training_session(session_id))
  WITH CHECK (public.owns_training_session(session_id));

DROP POLICY IF EXISTS "Trainers read shared training sessions" ON training_sessions;
CREATE POLICY "Trainers read shared training sessions"
  ON training_sessions FOR SELECT
  USING (public.trainer_can_access_session(id, user_id));

DROP POLICY IF EXISTS "Trainers update coaching fields on shared sessions" ON training_sessions;
CREATE POLICY "Trainers update coaching fields on shared sessions"
  ON training_sessions FOR UPDATE
  USING (public.trainer_can_access_session(id, user_id))
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.coach_connections c
      WHERE c.trainer_id = auth.uid()
        AND c.rider_id = training_sessions.user_id
        AND c.status = 'active'
    )
  );

NOTIFY pgrst, 'reload schema';
