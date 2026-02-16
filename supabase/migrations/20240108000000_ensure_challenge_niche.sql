-- Ensure niche column exists on challenges (fixes "niche not in schema cache" if 20240105 was not applied)
ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS niche TEXT
  CHECK (niche IN ('dressage', 'rider', 'reining', 'young_horse'));

CREATE INDEX IF NOT EXISTS idx_challenges_niche ON challenges(niche) WHERE niche IS NOT NULL;
