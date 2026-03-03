-- ============================================================================
-- COMMENT MEDIA TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS comment_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comment_media_comment ON comment_media(comment_id);

-- Track which specific comment a reply is targeting within a thread
ALTER TABLE comments ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES comments(id) ON DELETE SET NULL;

-- RLS policies for comment_media
ALTER TABLE comment_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comment media"
  ON comment_media FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert comment media"
  ON comment_media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM comments
      WHERE comments.id = comment_media.comment_id
        AND comments.author_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own comment media"
  ON comment_media FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM comments
      WHERE comments.id = comment_media.comment_id
        AND comments.author_id = auth.uid()
    )
  );
