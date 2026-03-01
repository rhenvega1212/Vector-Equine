-- Course Builder: schema changes for polymorphic blocks, gating, discussions,
-- submissions with AI/trainer feedback, and per-block progress tracking.

-- ============================================================
-- 1. Alter lesson_content_blocks
-- ============================================================

-- Drop the old CHECK constraint on block_type so we can expand it
ALTER TABLE lesson_content_blocks
  DROP CONSTRAINT IF EXISTS lesson_content_blocks_block_type_check;

ALTER TABLE lesson_content_blocks
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS estimated_time INTEGER;

ALTER TABLE lesson_content_blocks
  ADD CONSTRAINT lesson_content_blocks_block_type_check
  CHECK (block_type IN (
    'rich_text','image','video','file',
    'discussion','submission','quiz','checklist',
    'download','callout','divider','trainer_link'
  ));

-- ============================================================
-- 2. Alter challenge_lessons
-- ============================================================

ALTER TABLE challenge_lessons
  ADD COLUMN IF NOT EXISTS estimated_time INTEGER,
  ADD COLUMN IF NOT EXISTS gating_type TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS gating_rules JSONB DEFAULT '{}';

-- Add CHECK after column exists
DO $$ BEGIN
  ALTER TABLE challenge_lessons
    ADD CONSTRAINT challenge_lessons_gating_type_check
    CHECK (gating_type IN ('none','soft','hard'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. Alter challenge_modules
-- ============================================================

ALTER TABLE challenge_modules
  ADD COLUMN IF NOT EXISTS gating_type TEXT DEFAULT 'none';

DO $$ BEGIN
  ALTER TABLE challenge_modules
    ADD CONSTRAINT challenge_modules_gating_type_check
    CHECK (gating_type IN ('none','soft','hard'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 4. Alter submissions
-- ============================================================

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS block_id UUID REFERENCES lesson_content_blocks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS notes TEXT;

DO $$ BEGIN
  ALTER TABLE submissions
    ADD CONSTRAINT submissions_status_check
    CHECK (status IN ('not_started','submitted','in_review','feedback_delivered','needs_resubmission'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE submissions
  ALTER COLUMN assignment_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_block ON submissions(block_id);

-- ============================================================
-- 5. New table: block_completions
-- ============================================================

CREATE TABLE IF NOT EXISTS block_completions (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  block_id UUID NOT NULL REFERENCES lesson_content_blocks(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, block_id)
);

CREATE INDEX IF NOT EXISTS idx_block_completions_user ON block_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_block_completions_block ON block_completions(block_id);

-- ============================================================
-- 6. New table: discussion_posts
-- ============================================================

CREATE TABLE IF NOT EXISTS discussion_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES lesson_content_blocks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES discussion_posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discussion_posts_block ON discussion_posts(block_id);
CREATE INDEX IF NOT EXISTS idx_discussion_posts_user ON discussion_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_discussion_posts_parent ON discussion_posts(parent_id);

-- ============================================================
-- 7. New table: discussion_reactions
-- ============================================================

CREATE TABLE IF NOT EXISTS discussion_reactions (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES discussion_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- ============================================================
-- 8. New table: ai_submission_feedback
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_submission_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  result_json JSONB NOT NULL,
  model TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_submission_feedback_sub ON ai_submission_feedback(submission_id);

-- ============================================================
-- 9. New table: trainer_feedback_requests
-- ============================================================

CREATE TABLE IF NOT EXISTS trainer_feedback_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES profiles(id),
  purchase_id UUID REFERENCES purchases(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','assigned','in_review','complete')),
  feedback TEXT,
  price_amount INTEGER,
  turnaround_days INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trainer_feedback_sub ON trainer_feedback_requests(submission_id);
CREATE INDEX IF NOT EXISTS idx_trainer_feedback_trainer ON trainer_feedback_requests(trainer_id);

-- ============================================================
-- 10. RLS policies
-- ============================================================

ALTER TABLE block_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_submission_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_feedback_requests ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is enrolled in the challenge that owns a block
CREATE OR REPLACE FUNCTION is_enrolled_for_block(uid UUID, bid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM lesson_content_blocks lcb
    JOIN challenge_lessons cl ON cl.id = lcb.lesson_id
    JOIN challenge_modules cm ON cm.id = cl.module_id
    JOIN challenge_enrollments ce ON ce.challenge_id = cm.challenge_id AND ce.user_id = uid
    WHERE lcb.id = bid
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- block_completions
CREATE POLICY "Users can read own block completions"
  ON block_completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Enrolled users can insert block completions"
  ON block_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_enrolled_for_block(auth.uid(), block_id));

CREATE POLICY "Admins can read all block completions"
  ON block_completions FOR SELECT
  USING (is_admin(auth.uid()));

-- discussion_posts
CREATE POLICY "Enrolled users can read discussion posts"
  ON discussion_posts FOR SELECT
  USING (is_enrolled_for_block(auth.uid(), block_id) OR is_admin(auth.uid()));

CREATE POLICY "Enrolled users can create discussion posts"
  ON discussion_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_enrolled_for_block(auth.uid(), block_id));

CREATE POLICY "Users can update own posts"
  ON discussion_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts or admins"
  ON discussion_posts FOR DELETE
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- discussion_reactions
CREATE POLICY "Enrolled users can read reactions"
  ON discussion_reactions FOR SELECT
  USING (is_enrolled_for_block(auth.uid(),
    (SELECT block_id FROM discussion_posts WHERE id = post_id))
    OR is_admin(auth.uid()));

CREATE POLICY "Enrolled users can react"
  ON discussion_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions"
  ON discussion_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- ai_submission_feedback
CREATE POLICY "Users can read own AI feedback"
  ON ai_submission_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM submissions s WHERE s.id = submission_id AND s.user_id = auth.uid()
    ) OR is_admin(auth.uid())
  );

CREATE POLICY "System can insert AI feedback"
  ON ai_submission_feedback FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

-- trainer_feedback_requests
CREATE POLICY "Users can read own trainer feedback"
  ON trainer_feedback_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM submissions s WHERE s.id = submission_id AND s.user_id = auth.uid()
    )
    OR trainer_id = auth.uid()
    OR is_admin(auth.uid())
  );

CREATE POLICY "Enrolled users can request trainer feedback"
  ON trainer_feedback_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM submissions s WHERE s.id = submission_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Trainers and admins can update feedback"
  ON trainer_feedback_requests FOR UPDATE
  USING (trainer_id = auth.uid() OR is_admin(auth.uid()));
