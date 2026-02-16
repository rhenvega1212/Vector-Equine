-- ============================================================================
-- TRAINING SESSIONS (rider performance logging)
-- ============================================================================
CREATE TABLE training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  horse TEXT NOT NULL,
  session_type TEXT NOT NULL CHECK (session_type IN ('ride', 'groundwork', 'lesson', 'hack', 'conditioning', 'other')),
  overall_feel INTEGER NOT NULL CHECK (overall_feel >= 1 AND overall_feel <= 10),
  discipline TEXT,
  exercises TEXT,
  notes TEXT,
  rhythm INTEGER CHECK (rhythm >= 1 AND rhythm <= 5),
  relaxation INTEGER CHECK (relaxation >= 1 AND relaxation <= 5),
  connection INTEGER CHECK (connection >= 1 AND connection <= 5),
  impulsion INTEGER CHECK (impulsion >= 1 AND impulsion <= 5),
  straightness INTEGER CHECK (straightness >= 1 AND straightness <= 5),
  collection INTEGER CHECK (collection >= 1 AND collection <= 5),
  competition_prep BOOLEAN DEFAULT FALSE,
  focused_goal_session BOOLEAN DEFAULT FALSE,
  video_link_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_training_sessions_user ON training_sessions(user_id);
CREATE INDEX idx_training_sessions_date ON training_sessions(session_date);
CREATE INDEX idx_training_sessions_user_date ON training_sessions(user_id, session_date DESC);

ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own training sessions"
  ON training_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- AI TRAINER: video uploads and analysis artifacts
-- ============================================================================
CREATE TABLE ai_video_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  horse TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_video_uploads_user ON ai_video_uploads(user_id);

ALTER TABLE ai_video_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own AI video uploads"
  ON ai_video_uploads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- AI analysis results (one per video, JSON for flexibility)
-- ============================================================================
CREATE TABLE ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES ai_video_uploads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'error')),
  result_json JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_ai_analyses_video ON ai_analyses(video_id);

ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analyses for own videos"
  ON ai_analyses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_video_uploads v
      WHERE v.id = ai_analyses.video_id AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert analyses for own videos"
  ON ai_analyses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_video_uploads v
      WHERE v.id = ai_analyses.video_id AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update analyses for own videos"
  ON ai_analyses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM ai_video_uploads v
      WHERE v.id = ai_analyses.video_id AND v.user_id = auth.uid()
    )
  );

-- ============================================================================
-- AI chat messages (conversation about an analyzed video)
-- ============================================================================
CREATE TABLE ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES ai_analyses(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_chat_messages_analysis ON ai_chat_messages(analysis_id);

ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage chat messages for own analyses"
  ON ai_chat_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ai_analyses a
      JOIN ai_video_uploads v ON v.id = a.video_id
      WHERE a.id = ai_chat_messages.analysis_id AND v.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_analyses a
      JOIN ai_video_uploads v ON v.id = a.video_id
      WHERE a.id = ai_chat_messages.analysis_id AND v.user_id = auth.uid()
    )
  );

-- Trigger for training_sessions updated_at
CREATE TRIGGER update_training_sessions_updated_at
  BEFORE UPDATE ON training_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for AI Trainer video uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-training-videos', 'ai-training-videos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own AI training videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ai-training-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own AI training videos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'ai-training-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own AI training videos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ai-training-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
