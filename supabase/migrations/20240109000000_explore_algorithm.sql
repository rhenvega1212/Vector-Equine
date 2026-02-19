-- ============================================================================
-- EXPLORE ALGORITHM TABLES
-- ============================================================================

-- User blocks / mutes
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL DEFAULT 'block' CHECK (block_type IN ('block', 'mute')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX idx_user_blocks_blocked ON user_blocks(blocked_id);

-- User interests (tag weights inferred from engagement)
CREATE TABLE IF NOT EXISTS user_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tag)
);

CREATE INDEX idx_user_interests_user ON user_interests(user_id);
CREATE INDEX idx_user_interests_tag ON user_interests(tag);

-- User seen items (cooldown tracking for explore)
CREATE TABLE IF NOT EXISTS user_seen_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('post', 'ad', 'account')),
  seen_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_seen_items_user ON user_seen_items(user_id);
CREATE INDEX idx_user_seen_items_lookup ON user_seen_items(user_id, item_type, item_id);
CREATE INDEX idx_user_seen_items_seen_at ON user_seen_items(seen_at);

-- User location bucket (approximate location, opt-in)
CREATE TABLE IF NOT EXISTS user_location_bucket (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'US',
  geohash_prefix TEXT,
  location_enabled BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_location_bucket_geohash ON user_location_bucket(geohash_prefix);
CREATE INDEX idx_user_location_bucket_city ON user_location_bucket(city, state);

-- Ads table
CREATE TABLE IF NOT EXISTS ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_name TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  image_url TEXT,
  click_url TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  daily_budget_cents INTEGER,
  total_impressions INTEGER DEFAULT 0,
  max_impressions_per_user INTEGER DEFAULT 3,
  frequency_cap_hours INTEGER DEFAULT 24,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ads_active ON ads(is_active);
CREATE INDEX idx_ads_tags ON ads USING GIN(tags);

-- Triggers
CREATE TRIGGER update_user_interests_updated_at
  BEFORE UPDATE ON user_interests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_location_bucket_updated_at
  BEFORE UPDATE ON user_location_bucket
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ads_updated_at
  BEFORE UPDATE ON ads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS policies
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_seen_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_location_bucket ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own blocks" ON user_blocks
  FOR ALL USING (auth.uid() = blocker_id);

CREATE POLICY "Users can read own interests" ON user_interests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage interests" ON user_interests
  FOR ALL USING (true);

CREATE POLICY "Users can manage own seen items" ON user_seen_items
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own location" ON user_location_bucket
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read active ads" ON ads
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage ads" ON ads
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
