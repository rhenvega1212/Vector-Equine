-- ============================================================================
-- CHALLENGE SCHEDULING AND ARCHIVING
-- ============================================================================
-- Adds: schedule_type (scheduled|evergreen), open_at, close_at, start_at, end_at
-- Extends status to: draft | published | active | archived
-- Company content = enrolled_only when not archived; participant content visible in archive.
-- ============================================================================

-- New columns on challenges
ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS schedule_type TEXT DEFAULT 'scheduled'
    CHECK (schedule_type IN ('scheduled', 'evergreen')),
  ADD COLUMN IF NOT EXISTS open_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS close_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;

-- Extend status to include active and archived (keep published for backward compat)
ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_status_check;
ALTER TABLE challenges ADD CONSTRAINT challenges_status_check
  CHECK (status IN ('draft', 'published', 'active', 'archived'));

-- Migrate existing published -> active
UPDATE challenges SET status = 'active' WHERE status = 'published';

-- Indexes for scheduling and archive job
CREATE INDEX IF NOT EXISTS idx_challenges_schedule_type ON challenges(schedule_type);
CREATE INDEX IF NOT EXISTS idx_challenges_end_at ON challenges(end_at) WHERE schedule_type = 'scheduled' AND status IN ('published', 'active');
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);

-- Helper: challenge is archived (read-only, no new enrollments/submissions)
CREATE OR REPLACE FUNCTION challenge_is_archived(c_id UUID)
RETURNS BOOLEAN AS $$
  SELECT status = 'archived' FROM challenges WHERE id = c_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: challenge is "live" (active or legacy published)
CREATE OR REPLACE FUNCTION challenge_is_live(c_id UUID)
RETURNS BOOLEAN AS $$
  SELECT status IN ('published', 'active') FROM challenges WHERE id = c_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: enrollment window is open for a challenge (for scheduled: open_at <= now and (close_at is null or close_at >= now); evergreen always open when live)
CREATE OR REPLACE FUNCTION challenge_enrollment_open(c_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM challenges c
    WHERE c.id = c_id
    AND c.status IN ('published', 'active')
    AND (
      c.schedule_type = 'evergreen'
      OR (
        (c.open_at IS NULL OR c.open_at <= NOW())
        AND (c.close_at IS NULL OR c.close_at >= NOW())
      )
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- ARCHIVE JOB: set status to archived when end_at has passed (scheduled only)
-- ============================================================================
CREATE OR REPLACE FUNCTION archive_ended_challenges()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE challenges
    SET status = 'archived', updated_at = NOW()
    WHERE schedule_type = 'scheduled'
      AND end_at IS NOT NULL
      AND end_at < NOW()
      AND status IN ('published', 'active')
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO updated_count FROM updated;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS: CHALLENGES - allow viewing archived for public archive (participant content)
-- ============================================================================
DROP POLICY IF EXISTS "Challenges viewable based on status and enrollment" ON challenges;
CREATE POLICY "Challenges viewable based on status and enrollment"
  ON challenges FOR SELECT
  USING (
    (status IN ('published', 'active') AND is_private = FALSE)
    OR (status IN ('published', 'active') AND is_enrolled_in_challenge(auth.uid(), id))
    OR (status = 'archived')
    OR creator_id = auth.uid()
    OR is_admin(auth.uid())
  );

-- ============================================================================
-- RLS: COMPANY CONTENT - hide from non-admins when archived (modules, lessons, blocks, assignments)
-- ============================================================================
DROP POLICY IF EXISTS "Modules viewable with challenge" ON challenge_modules;
CREATE POLICY "Modules viewable with challenge"
  ON challenge_modules FOR SELECT
  USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM challenges c
      WHERE c.id = challenge_modules.challenge_id
      AND c.status IN ('published', 'active')
      AND (
        (c.is_private = FALSE) OR is_enrolled_in_challenge(auth.uid(), c.id)
      )
    )
  );

DROP POLICY IF EXISTS "Lessons viewable with module" ON challenge_lessons;
CREATE POLICY "Lessons viewable with module"
  ON challenge_lessons FOR SELECT
  USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM challenge_modules m
      JOIN challenges c ON c.id = m.challenge_id
      WHERE m.id = challenge_lessons.module_id
      AND c.status IN ('published', 'active')
      AND ((c.is_private = FALSE) OR is_enrolled_in_challenge(auth.uid(), c.id))
    )
  );

DROP POLICY IF EXISTS "Content blocks viewable with lesson" ON lesson_content_blocks;
CREATE POLICY "Content blocks viewable with lesson"
  ON lesson_content_blocks FOR SELECT
  USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM challenge_lessons l
      JOIN challenge_modules m ON m.id = l.module_id
      JOIN challenges c ON c.id = m.challenge_id
      WHERE l.id = lesson_content_blocks.lesson_id
      AND c.status IN ('published', 'active')
      AND ((c.is_private = FALSE) OR is_enrolled_in_challenge(auth.uid(), c.id))
    )
  );

-- Assignments: company content when active + enrolled; assignment titles OK in archive view
DROP POLICY IF EXISTS "Assignments viewable with lesson" ON assignments;
CREATE POLICY "Assignments viewable with lesson"
  ON assignments FOR SELECT
  USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM challenge_lessons l
      JOIN challenge_modules m ON m.id = l.module_id
      JOIN challenges c ON c.id = m.challenge_id
      WHERE l.id = assignments.lesson_id
      AND (
        (c.status IN ('published', 'active') AND ((c.is_private = FALSE) OR is_enrolled_in_challenge(auth.uid(), c.id)))
        OR c.status = 'archived'
      )
    )
  );

-- ============================================================================
-- RLS: ENROLLMENTS - only when challenge is live and enrollment window open
-- ============================================================================
DROP POLICY IF EXISTS "Users can enroll in challenges" ON challenge_enrollments;
CREATE POLICY "Users can enroll in challenges"
  ON challenge_enrollments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND challenge_enrollment_open(challenge_id)
  );

-- ============================================================================
-- RLS: SUBMISSIONS - viewable by enrolled (active) OR by anyone when archived (archive view); no INSERT/UPDATE when archived
-- ============================================================================
DROP POLICY IF EXISTS "Submissions viewable by enrolled users and admins" ON submissions;
CREATE POLICY "Submissions viewable by enrolled users and admins"
  ON submissions FOR SELECT
  USING (
    auth.uid() = user_id
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM assignments a
      JOIN challenge_lessons l ON l.id = a.lesson_id
      JOIN challenge_modules m ON m.id = l.module_id
      JOIN challenges c ON c.id = m.challenge_id
      WHERE a.id = submissions.assignment_id
      AND (
        (c.status IN ('published', 'active') AND is_enrolled_in_challenge(auth.uid(), c.id))
        OR c.status = 'archived'
      )
    )
  );

-- Block submission INSERT when challenge is archived
DROP POLICY IF EXISTS "Enrolled users can create submissions" ON submissions;
CREATE POLICY "Enrolled users can create submissions"
  ON submissions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM assignments a
      JOIN challenge_lessons l ON l.id = a.lesson_id
      JOIN challenge_modules m ON m.id = l.module_id
      JOIN challenges c ON c.id = m.challenge_id
      WHERE a.id = submissions.assignment_id
      AND c.status IN ('published', 'active')
      AND is_enrolled_in_challenge(auth.uid(), c.id)
    )
  );

-- Block submission UPDATE when challenge is archived (admin can still add feedback if we allow; for now restrict to non-archived)
DROP POLICY IF EXISTS "Users and admins can update submissions" ON submissions;
CREATE POLICY "Users and admins can update submissions"
  ON submissions FOR UPDATE
  USING (
    (auth.uid() = user_id OR is_admin(auth.uid()))
    AND NOT EXISTS (
      SELECT 1 FROM assignments a
      JOIN challenge_lessons l ON l.id = a.lesson_id
      JOIN challenge_modules m ON m.id = l.module_id
      JOIN challenges c ON c.id = m.challenge_id
      WHERE a.id = submissions.assignment_id AND c.status = 'archived'
    )
  );

-- ============================================================================
-- RLS: SUBMISSION LIKES - no new likes when archived
-- ============================================================================
DROP POLICY IF EXISTS "Enrolled users can like submissions" ON submission_likes;
CREATE POLICY "Enrolled users can like submissions"
  ON submission_likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
      JOIN challenge_lessons l ON l.id = a.lesson_id
      JOIN challenge_modules m ON m.id = l.module_id
      JOIN challenges c ON c.id = m.challenge_id
      WHERE s.id = submission_likes.submission_id
      AND c.status IN ('published', 'active')
      AND is_enrolled_in_challenge(auth.uid(), c.id)
    )
  );

-- Submission likes visible when enrolled in active OR when challenge archived (archive view)
DROP POLICY IF EXISTS "Submission likes viewable by enrolled users" ON submission_likes;
CREATE POLICY "Submission likes viewable by enrolled users"
  ON submission_likes FOR SELECT
  USING (
    auth.uid() = user_id
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
      JOIN challenge_lessons l ON l.id = a.lesson_id
      JOIN challenge_modules m ON m.id = l.module_id
      JOIN challenges c ON c.id = m.challenge_id
      WHERE s.id = submission_likes.submission_id
      AND (
        (c.status IN ('published', 'active') AND is_enrolled_in_challenge(auth.uid(), c.id))
        OR c.status = 'archived'
      )
    )
  );

-- ============================================================================
-- RLS: SUBMISSION COMMENTS - no new comments when archived; visible in archive
-- ============================================================================
DROP POLICY IF EXISTS "Submission comments viewable by enrolled users" ON submission_comments;
CREATE POLICY "Submission comments viewable by enrolled users"
  ON submission_comments FOR SELECT
  USING (
    author_id = auth.uid()
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
      JOIN challenge_lessons l ON l.id = a.lesson_id
      JOIN challenge_modules m ON m.id = l.module_id
      JOIN challenges c ON c.id = m.challenge_id
      WHERE s.id = submission_comments.submission_id
      AND (
        (c.status IN ('published', 'active') AND is_enrolled_in_challenge(auth.uid(), c.id))
        OR c.status = 'archived'
      )
    )
  );

DROP POLICY IF EXISTS "Enrolled users can comment on submissions" ON submission_comments;
CREATE POLICY "Enrolled users can comment on submissions"
  ON submission_comments FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
      JOIN challenge_lessons l ON l.id = a.lesson_id
      JOIN challenge_modules m ON m.id = l.module_id
      JOIN challenges c ON c.id = m.challenge_id
      WHERE s.id = submission_comments.submission_id
      AND c.status IN ('published', 'active')
      AND is_enrolled_in_challenge(auth.uid(), c.id)
    )
  );

-- Block comment DELETE/UPDATE when challenge archived (optional: allow delete own comment; keep simple - allow delete own, no update)
-- Existing policy "Users can delete own submission comments" stays; no UPDATE policy on comments so no change.

-- ============================================================================
-- RLS: LESSON COMPLETIONS - no new completions when archived
-- ============================================================================
DROP POLICY IF EXISTS "Enrolled users can mark lessons complete" ON lesson_completions;
CREATE POLICY "Enrolled users can mark lessons complete"
  ON lesson_completions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM challenge_lessons l
      JOIN challenge_modules m ON m.id = l.module_id
      JOIN challenges c ON c.id = m.challenge_id
      JOIN challenge_enrollments e ON e.challenge_id = c.id AND e.user_id = auth.uid()
      WHERE l.id = lesson_completions.lesson_id
      AND c.status IN ('published', 'active')
    )
  );
