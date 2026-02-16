-- Add niche/category for challenges (e.g. dressage, rider, reining, young horse)
ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS niche TEXT
  CHECK (niche IN ('dressage', 'rider', 'reining', 'young_horse'));

CREATE INDEX IF NOT EXISTS idx_challenges_niche ON challenges(niche) WHERE niche IS NOT NULL;

COMMENT ON COLUMN challenges.niche IS 'Course niche: dressage, rider, reining, young_horse';
