-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_comments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is approved trainer
CREATE OR REPLACE FUNCTION is_approved_trainer(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND role = 'trainer' 
    AND trainer_approved = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is enrolled in a challenge
CREATE OR REPLACE FUNCTION is_enrolled_in_challenge(user_id UUID, challenge_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM challenge_enrollments 
    WHERE challenge_enrollments.user_id = is_enrolled_in_challenge.user_id 
    AND challenge_enrollments.challenge_id = is_enrolled_in_challenge.challenge_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

-- Anyone can view profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Allow insert on signup (handled by auth trigger)
CREATE POLICY "Enable insert for authenticated users only"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- POSTS POLICIES
-- ============================================================================

-- Anyone can view non-hidden posts
CREATE POLICY "Posts are viewable by everyone except hidden ones"
  ON posts FOR SELECT
  USING (is_hidden = FALSE OR author_id = auth.uid() OR is_admin(auth.uid()));

-- Authenticated users can create posts
CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Users can update their own posts
CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  USING (auth.uid() = author_id OR is_admin(auth.uid()));

-- Users can delete their own posts
CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  USING (auth.uid() = author_id OR is_admin(auth.uid()));

-- ============================================================================
-- POST MEDIA POLICIES
-- ============================================================================

-- Anyone can view post media for viewable posts
CREATE POLICY "Post media viewable with posts"
  ON post_media FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM posts 
    WHERE posts.id = post_media.post_id 
    AND (posts.is_hidden = FALSE OR posts.author_id = auth.uid() OR is_admin(auth.uid()))
  ));

-- Users can insert media for their own posts
CREATE POLICY "Users can add media to own posts"
  ON post_media FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM posts WHERE posts.id = post_media.post_id AND posts.author_id = auth.uid()
  ));

-- Users can delete their own post media
CREATE POLICY "Users can delete own post media"
  ON post_media FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM posts WHERE posts.id = post_media.post_id AND posts.author_id = auth.uid()
  ));

-- ============================================================================
-- FOLLOWS POLICIES
-- ============================================================================

-- Anyone can view follows
CREATE POLICY "Follows are viewable by everyone"
  ON follows FOR SELECT
  USING (true);

-- Authenticated users can follow others
CREATE POLICY "Users can follow others"
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id AND auth.uid() != following_id);

-- Users can unfollow
CREATE POLICY "Users can unfollow"
  ON follows FOR DELETE
  USING (auth.uid() = follower_id);

-- ============================================================================
-- POST LIKES POLICIES
-- ============================================================================

-- Anyone can view likes
CREATE POLICY "Post likes are viewable by everyone"
  ON post_likes FOR SELECT
  USING (true);

-- Authenticated users can like posts
CREATE POLICY "Users can like posts"
  ON post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can unlike
CREATE POLICY "Users can unlike posts"
  ON post_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENTS POLICIES
-- ============================================================================

-- Anyone can view comments on viewable posts
CREATE POLICY "Comments are viewable on viewable posts"
  ON comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM posts 
    WHERE posts.id = comments.post_id 
    AND (posts.is_hidden = FALSE OR posts.author_id = auth.uid() OR is_admin(auth.uid()))
  ));

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can comment"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE
  USING (auth.uid() = author_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING (auth.uid() = author_id OR is_admin(auth.uid()));

-- ============================================================================
-- REPORTS POLICIES
-- ============================================================================

-- Only admins can view all reports
CREATE POLICY "Admins can view all reports"
  ON reports FOR SELECT
  USING (is_admin(auth.uid()));

-- Users can create reports
CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Only admins can update reports
CREATE POLICY "Admins can update reports"
  ON reports FOR UPDATE
  USING (is_admin(auth.uid()));

-- ============================================================================
-- EVENTS POLICIES
-- ============================================================================

-- Anyone can view published events
CREATE POLICY "Published events are viewable by everyone"
  ON events FOR SELECT
  USING (is_published = TRUE OR host_id = auth.uid() OR is_admin(auth.uid()));

-- Approved trainers and admins can create events
CREATE POLICY "Approved trainers and admins can create events"
  ON events FOR INSERT
  WITH CHECK (
    auth.uid() = host_id AND (is_admin(auth.uid()) OR is_approved_trainer(auth.uid()))
  );

-- Hosts can update their own events, admins can update any
CREATE POLICY "Hosts can update own events"
  ON events FOR UPDATE
  USING (auth.uid() = host_id OR is_admin(auth.uid()));

-- Hosts can delete their own events, admins can delete any
CREATE POLICY "Hosts can delete own events"
  ON events FOR DELETE
  USING (auth.uid() = host_id OR is_admin(auth.uid()));

-- ============================================================================
-- EVENT RSVPS POLICIES
-- ============================================================================

-- Event hosts and attendees can view RSVPs
CREATE POLICY "RSVPs viewable by event host and admins"
  ON event_rsvps FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM events WHERE events.id = event_rsvps.event_id AND events.host_id = auth.uid())
    OR is_admin(auth.uid())
  );

-- Users can RSVP to events
CREATE POLICY "Users can RSVP to events"
  ON event_rsvps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their RSVP
CREATE POLICY "Users can update own RSVP"
  ON event_rsvps FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can remove their RSVP
CREATE POLICY "Users can remove own RSVP"
  ON event_rsvps FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- CHALLENGES POLICIES
-- ============================================================================

-- Published public challenges visible to all, private visible to enrolled and admins
CREATE POLICY "Challenges viewable based on status and enrollment"
  ON challenges FOR SELECT
  USING (
    (status = 'published' AND is_private = FALSE)
    OR creator_id = auth.uid()
    OR is_admin(auth.uid())
    OR (status = 'published' AND is_enrolled_in_challenge(auth.uid(), id))
  );

-- Only admins can create challenges
CREATE POLICY "Only admins can create challenges"
  ON challenges FOR INSERT
  WITH CHECK (is_admin(auth.uid()) AND auth.uid() = creator_id);

-- Only admins can update challenges
CREATE POLICY "Only admins can update challenges"
  ON challenges FOR UPDATE
  USING (is_admin(auth.uid()));

-- Only admins can delete challenges
CREATE POLICY "Only admins can delete challenges"
  ON challenges FOR DELETE
  USING (is_admin(auth.uid()));

-- ============================================================================
-- CHALLENGE MODULES POLICIES
-- ============================================================================

-- Modules viewable with challenge
CREATE POLICY "Modules viewable with challenge"
  ON challenge_modules FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM challenges 
    WHERE challenges.id = challenge_modules.challenge_id 
    AND (
      (challenges.status = 'published' AND challenges.is_private = FALSE)
      OR challenges.creator_id = auth.uid()
      OR is_admin(auth.uid())
      OR (challenges.status = 'published' AND is_enrolled_in_challenge(auth.uid(), challenges.id))
    )
  ));

-- Only admins can manage modules
CREATE POLICY "Only admins can create modules"
  ON challenge_modules FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update modules"
  ON challenge_modules FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete modules"
  ON challenge_modules FOR DELETE
  USING (is_admin(auth.uid()));

-- ============================================================================
-- CHALLENGE LESSONS POLICIES
-- ============================================================================

-- Lessons viewable with module
CREATE POLICY "Lessons viewable with module"
  ON challenge_lessons FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM challenge_modules
    JOIN challenges ON challenges.id = challenge_modules.challenge_id
    WHERE challenge_modules.id = challenge_lessons.module_id
    AND (
      (challenges.status = 'published' AND challenges.is_private = FALSE)
      OR challenges.creator_id = auth.uid()
      OR is_admin(auth.uid())
      OR (challenges.status = 'published' AND is_enrolled_in_challenge(auth.uid(), challenges.id))
    )
  ));

-- Only admins can manage lessons
CREATE POLICY "Only admins can create lessons"
  ON challenge_lessons FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update lessons"
  ON challenge_lessons FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete lessons"
  ON challenge_lessons FOR DELETE
  USING (is_admin(auth.uid()));

-- ============================================================================
-- LESSON CONTENT BLOCKS POLICIES
-- ============================================================================

-- Content blocks viewable with lesson
CREATE POLICY "Content blocks viewable with lesson"
  ON lesson_content_blocks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM challenge_lessons
    JOIN challenge_modules ON challenge_modules.id = challenge_lessons.module_id
    JOIN challenges ON challenges.id = challenge_modules.challenge_id
    WHERE challenge_lessons.id = lesson_content_blocks.lesson_id
    AND (
      (challenges.status = 'published' AND challenges.is_private = FALSE)
      OR challenges.creator_id = auth.uid()
      OR is_admin(auth.uid())
      OR (challenges.status = 'published' AND is_enrolled_in_challenge(auth.uid(), challenges.id))
    )
  ));

-- Only admins can manage content blocks
CREATE POLICY "Only admins can create content blocks"
  ON lesson_content_blocks FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update content blocks"
  ON lesson_content_blocks FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete content blocks"
  ON lesson_content_blocks FOR DELETE
  USING (is_admin(auth.uid()));

-- ============================================================================
-- CHALLENGE ENROLLMENTS POLICIES
-- ============================================================================

-- Users can see their own enrollments, admins see all
CREATE POLICY "Enrollments viewable by user and admins"
  ON challenge_enrollments FOR SELECT
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- Users can enroll in published challenges
CREATE POLICY "Users can enroll in challenges"
  ON challenge_enrollments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM challenges 
      WHERE challenges.id = challenge_enrollments.challenge_id 
      AND challenges.status = 'published'
    )
  );

-- Users can update their own enrollment
CREATE POLICY "Users can update own enrollment"
  ON challenge_enrollments FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- LESSON COMPLETIONS POLICIES
-- ============================================================================

-- Users can see their own completions, admins see all
CREATE POLICY "Completions viewable by user and admins"
  ON lesson_completions FOR SELECT
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- Users can mark lessons complete if enrolled
CREATE POLICY "Enrolled users can mark lessons complete"
  ON lesson_completions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM challenge_lessons
      JOIN challenge_modules ON challenge_modules.id = challenge_lessons.module_id
      JOIN challenge_enrollments ON challenge_enrollments.challenge_id = challenge_modules.challenge_id
      WHERE challenge_lessons.id = lesson_completions.lesson_id
      AND challenge_enrollments.user_id = auth.uid()
    )
  );

-- ============================================================================
-- ASSIGNMENTS POLICIES
-- ============================================================================

-- Assignments viewable with lesson
CREATE POLICY "Assignments viewable with lesson"
  ON assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM challenge_lessons
    JOIN challenge_modules ON challenge_modules.id = challenge_lessons.module_id
    JOIN challenges ON challenges.id = challenge_modules.challenge_id
    WHERE challenge_lessons.id = assignments.lesson_id
    AND (
      (challenges.status = 'published' AND challenges.is_private = FALSE)
      OR challenges.creator_id = auth.uid()
      OR is_admin(auth.uid())
      OR (challenges.status = 'published' AND is_enrolled_in_challenge(auth.uid(), challenges.id))
    )
  ));

-- Only admins can manage assignments
CREATE POLICY "Only admins can create assignments"
  ON assignments FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update assignments"
  ON assignments FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete assignments"
  ON assignments FOR DELETE
  USING (is_admin(auth.uid()));

-- ============================================================================
-- SUBMISSIONS POLICIES
-- ============================================================================

-- Submissions viewable by enrolled users and admins
CREATE POLICY "Submissions viewable by enrolled users and admins"
  ON submissions FOR SELECT
  USING (
    auth.uid() = user_id 
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM assignments
      JOIN challenge_lessons ON challenge_lessons.id = assignments.lesson_id
      JOIN challenge_modules ON challenge_modules.id = challenge_lessons.module_id
      JOIN challenge_enrollments ON challenge_enrollments.challenge_id = challenge_modules.challenge_id
      WHERE assignments.id = submissions.assignment_id
      AND challenge_enrollments.user_id = auth.uid()
    )
  );

-- Enrolled users can create submissions
CREATE POLICY "Enrolled users can create submissions"
  ON submissions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM assignments
      JOIN challenge_lessons ON challenge_lessons.id = assignments.lesson_id
      JOIN challenge_modules ON challenge_modules.id = challenge_lessons.module_id
      JOIN challenge_enrollments ON challenge_enrollments.challenge_id = challenge_modules.challenge_id
      WHERE assignments.id = submissions.assignment_id
      AND challenge_enrollments.user_id = auth.uid()
    )
  );

-- Users can update their own submissions, admins can add feedback
CREATE POLICY "Users and admins can update submissions"
  ON submissions FOR UPDATE
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- ============================================================================
-- SUBMISSION LIKES POLICIES
-- ============================================================================

-- Submission likes viewable by enrolled users and admins
CREATE POLICY "Submission likes viewable by enrolled users"
  ON submission_likes FOR SELECT
  USING (
    auth.uid() = user_id 
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM submissions
      JOIN assignments ON assignments.id = submissions.assignment_id
      JOIN challenge_lessons ON challenge_lessons.id = assignments.lesson_id
      JOIN challenge_modules ON challenge_modules.id = challenge_lessons.module_id
      JOIN challenge_enrollments ON challenge_enrollments.challenge_id = challenge_modules.challenge_id
      WHERE submissions.id = submission_likes.submission_id
      AND challenge_enrollments.user_id = auth.uid()
    )
  );

-- Enrolled users can like submissions
CREATE POLICY "Enrolled users can like submissions"
  ON submission_likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM submissions
      JOIN assignments ON assignments.id = submissions.assignment_id
      JOIN challenge_lessons ON challenge_lessons.id = assignments.lesson_id
      JOIN challenge_modules ON challenge_modules.id = challenge_lessons.module_id
      JOIN challenge_enrollments ON challenge_enrollments.challenge_id = challenge_modules.challenge_id
      WHERE submissions.id = submission_likes.submission_id
      AND challenge_enrollments.user_id = auth.uid()
    )
  );

-- Users can remove their likes
CREATE POLICY "Users can remove submission likes"
  ON submission_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SUBMISSION COMMENTS POLICIES
-- ============================================================================

-- Submission comments viewable by enrolled users and admins
CREATE POLICY "Submission comments viewable by enrolled users"
  ON submission_comments FOR SELECT
  USING (
    auth.uid() = author_id 
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM submissions
      JOIN assignments ON assignments.id = submissions.assignment_id
      JOIN challenge_lessons ON challenge_lessons.id = assignments.lesson_id
      JOIN challenge_modules ON challenge_modules.id = challenge_lessons.module_id
      JOIN challenge_enrollments ON challenge_enrollments.challenge_id = challenge_modules.challenge_id
      WHERE submissions.id = submission_comments.submission_id
      AND challenge_enrollments.user_id = auth.uid()
    )
  );

-- Enrolled users can comment on submissions
CREATE POLICY "Enrolled users can comment on submissions"
  ON submission_comments FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM submissions
      JOIN assignments ON assignments.id = submissions.assignment_id
      JOIN challenge_lessons ON challenge_lessons.id = assignments.lesson_id
      JOIN challenge_modules ON challenge_modules.id = challenge_lessons.module_id
      JOIN challenge_enrollments ON challenge_enrollments.challenge_id = challenge_modules.challenge_id
      WHERE submissions.id = submission_comments.submission_id
      AND challenge_enrollments.user_id = auth.uid()
    )
  );

-- Users can delete their own comments, admins can delete any
CREATE POLICY "Users can delete own submission comments"
  ON submission_comments FOR DELETE
  USING (auth.uid() = author_id OR is_admin(auth.uid()));
