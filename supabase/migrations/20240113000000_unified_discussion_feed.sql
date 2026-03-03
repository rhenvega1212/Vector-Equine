-- ============================================================================
-- UNIFIED DISCUSSION FEED
-- Adds challenge_id, block_id, and is_feed_visible to posts so that
-- challenge discussion posts flow through the same post system as regular
-- feed posts while supporting per-block filtering and opt-in feed visibility.
-- ============================================================================

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS block_id UUID REFERENCES lesson_content_blocks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_feed_visible BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_posts_challenge_id ON posts (challenge_id) WHERE challenge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_block_id ON posts (block_id) WHERE block_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_feed_visible ON posts (is_feed_visible) WHERE is_feed_visible = FALSE;
