-- ============================================================================
-- MIGRATION: Admin Improvements
-- Adds status system for events, notifications, and updated RLS
-- ============================================================================

-- ============================================================================
-- UPDATE EVENTS TABLE - Add status field
-- ============================================================================
ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived'));

-- Migrate existing data: is_published = true -> 'published', false -> 'draft'
UPDATE events SET status = CASE WHEN is_published = TRUE THEN 'published' ELSE 'draft' END WHERE status IS NULL;

-- Drop the old is_published column (keep for now for backward compatibility)
-- ALTER TABLE events DROP COLUMN IF EXISTS is_published;

-- Create index for status
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('follow', 'like', 'comment', 'reply', 'event_rsvp', 'challenge_enrollment')),
  actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ============================================================================
-- RLS FOR NOTIFICATIONS
-- ============================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- System can create notifications (via service role or triggers)
CREATE POLICY "Authenticated users can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- UPDATE EVENTS RLS - Support draft visibility for admins only
-- ============================================================================

-- Drop existing events policies and recreate
DROP POLICY IF EXISTS "Published events are viewable by everyone" ON events;
DROP POLICY IF EXISTS "Events viewable based on status" ON events;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Events: Published visible to all, Draft only to admins
CREATE POLICY "Events viewable based on status"
  ON events FOR SELECT
  USING (
    status = 'published' 
    OR is_admin(auth.uid())
    OR host_id = auth.uid()
  );

-- ============================================================================
-- UPDATE CHALLENGES RLS - Support draft visibility for admins only
-- ============================================================================

-- Drop existing challenge select policy and recreate
DROP POLICY IF EXISTS "Published challenges viewable by everyone" ON challenges;
DROP POLICY IF EXISTS "Challenges viewable based on status" ON challenges;

-- Challenges: Published visible to all, Draft only to admins
CREATE POLICY "Challenges viewable based on status"
  ON challenges FOR SELECT
  USING (
    status = 'published'
    OR is_admin(auth.uid())
  );

-- Only admins can create challenges
DROP POLICY IF EXISTS "Admins can create challenges" ON challenges;
CREATE POLICY "Admins can create challenges"
  ON challenges FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

-- Only admins can update challenges
DROP POLICY IF EXISTS "Admins can update challenges" ON challenges;
CREATE POLICY "Admins can update challenges"
  ON challenges FOR UPDATE
  USING (is_admin(auth.uid()));

-- Only admins can delete challenges
DROP POLICY IF EXISTS "Admins can delete challenges" ON challenges;
CREATE POLICY "Admins can delete challenges"
  ON challenges FOR DELETE
  USING (is_admin(auth.uid()));

-- ============================================================================
-- UPDATE CHALLENGE MODULES RLS - Inherit from challenge status
-- ============================================================================
DROP POLICY IF EXISTS "Challenge modules viewable with challenge" ON challenge_modules;
CREATE POLICY "Challenge modules viewable with challenge"
  ON challenge_modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM challenges c
      WHERE c.id = challenge_modules.challenge_id
      AND (c.status = 'published' OR is_admin(auth.uid()))
    )
  );

-- Only admins can manage modules
DROP POLICY IF EXISTS "Admins can manage modules" ON challenge_modules;
CREATE POLICY "Admins can insert modules"
  ON challenge_modules FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update modules"
  ON challenge_modules FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete modules"
  ON challenge_modules FOR DELETE
  USING (is_admin(auth.uid()));

-- ============================================================================
-- UPDATE CHALLENGE LESSONS RLS - Inherit from challenge status
-- ============================================================================
DROP POLICY IF EXISTS "Lessons viewable with module" ON challenge_lessons;
CREATE POLICY "Lessons viewable with challenge"
  ON challenge_lessons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM challenge_modules m
      JOIN challenges c ON c.id = m.challenge_id
      WHERE m.id = challenge_lessons.module_id
      AND (c.status = 'published' OR is_admin(auth.uid()))
    )
  );

-- Only admins can manage lessons
CREATE POLICY "Admins can insert lessons"
  ON challenge_lessons FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update lessons"
  ON challenge_lessons FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete lessons"
  ON challenge_lessons FOR DELETE
  USING (is_admin(auth.uid()));

-- ============================================================================
-- UPDATE CONTENT BLOCKS RLS
-- ============================================================================
DROP POLICY IF EXISTS "Content blocks viewable with lesson" ON lesson_content_blocks;
CREATE POLICY "Content blocks viewable with lesson"
  ON lesson_content_blocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM challenge_lessons l
      JOIN challenge_modules m ON m.id = l.module_id
      JOIN challenges c ON c.id = m.challenge_id
      WHERE l.id = lesson_content_blocks.lesson_id
      AND (c.status = 'published' OR is_admin(auth.uid()))
    )
  );

-- Only admins can manage content blocks
CREATE POLICY "Admins can insert content blocks"
  ON lesson_content_blocks FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update content blocks"
  ON lesson_content_blocks FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete content blocks"
  ON lesson_content_blocks FOR DELETE
  USING (is_admin(auth.uid()));

-- ============================================================================
-- UPDATE ASSIGNMENTS RLS
-- ============================================================================
CREATE POLICY "Admins can insert assignments"
  ON assignments FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update assignments"
  ON assignments FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete assignments"
  ON assignments FOR DELETE
  USING (is_admin(auth.uid()));
