-- Ask Vector turns, persisted per training session (lesson).
CREATE TABLE IF NOT EXISTS session_ask_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  asked_by_voice BOOLEAN NOT NULL DEFAULT false,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_ask_turns_session_created_idx
  ON session_ask_turns (training_session_id, created_at ASC);

ALTER TABLE session_ask_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read own ask turns"
  ON session_ask_turns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can insert own ask turns"
  ON session_ask_turns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can delete own ask turns"
  ON session_ask_turns FOR DELETE
  USING (auth.uid() = user_id);
