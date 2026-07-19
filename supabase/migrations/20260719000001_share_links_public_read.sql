-- =============================================================================
-- Brief-07 STEP D: public read for valid share_links (anonymous debrief view)
-- Prefer service-role API for full projection; these policies support anon token lookup.
-- =============================================================================

DROP POLICY IF EXISTS "Anyone can read valid share links by token" ON share_links;
CREATE POLICY "Anyone can read valid share links by token"
  ON share_links FOR SELECT
  USING (revoked = false AND (expires_at IS NULL OR expires_at > NOW()));

-- Allow anon/authenticated to read a training session when a valid share_link exists
DROP POLICY IF EXISTS "Public read sessions via valid share link" ON training_sessions;
CREATE POLICY "Public read sessions via valid share link"
  ON training_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM share_links sl
      WHERE sl.session_id = training_sessions.id
        AND sl.revoked = false
        AND (sl.expires_at IS NULL OR sl.expires_at > NOW())
    )
  );
