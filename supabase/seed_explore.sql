-- ============================================================================
-- SEED DATA FOR EXPLORE ALGORITHM (LOCAL DEVELOPMENT)
-- ============================================================================
-- Run AFTER seed.sql. Uses the same user IDs from that file.
-- Usage: psql $DATABASE_URL -f supabase/seed_explore.sql
--   or via Supabase dashboard SQL editor.
-- ============================================================================

-- User IDs from seed.sql:
--   admin:   a0000000-0000-0000-0000-000000000001
--   trainer: a0000000-0000-0000-0000-000000000002
--   rider1:  a0000000-0000-0000-0000-000000000003
--   rider2:  a0000000-0000-0000-0000-000000000004
--   rider3:  a0000000-0000-0000-0000-000000000005

-- ============================================================================
-- USER INTERESTS (inferred from engagement)
-- ============================================================================
INSERT INTO user_interests (user_id, tag, weight) VALUES
  ('a0000000-0000-0000-0000-000000000003', 'dressage',    3.2),
  ('a0000000-0000-0000-0000-000000000003', 'groundwork',  2.5),
  ('a0000000-0000-0000-0000-000000000003', 'training',    1.8),
  ('a0000000-0000-0000-0000-000000000004', 'jumping',     3.0),
  ('a0000000-0000-0000-0000-000000000004', 'eventing',    2.0),
  ('a0000000-0000-0000-0000-000000000004', 'fitness',     1.5),
  ('a0000000-0000-0000-0000-000000000005', 'reining',     3.5),
  ('a0000000-0000-0000-0000-000000000005', 'western',     2.8),
  ('a0000000-0000-0000-0000-000000000005', 'trail',       1.0),
  ('a0000000-0000-0000-0000-000000000002', 'dressage',    4.0),
  ('a0000000-0000-0000-0000-000000000002', 'training',    3.5),
  ('a0000000-0000-0000-0000-000000000002', 'biomechanics', 2.0)
ON CONFLICT (user_id, tag) DO NOTHING;

-- ============================================================================
-- USER LOCATION BUCKETS
-- ============================================================================
INSERT INTO user_location_bucket (user_id, city, state, country, geohash_prefix, location_enabled) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Austin',      'TX', 'US', '9v6k',  true),
  ('a0000000-0000-0000-0000-000000000002', 'Austin',      'TX', 'US', '9v6k',  true),
  ('a0000000-0000-0000-0000-000000000003', 'Austin',      'TX', 'US', '9v6m',  true),
  ('a0000000-0000-0000-0000-000000000004', 'San Antonio', 'TX', 'US', '9v4b',  true),
  ('a0000000-0000-0000-0000-000000000005', 'Dallas',      'TX', 'US', '9vg3',  false)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- ADS
-- ============================================================================
INSERT INTO ads (id, advertiser_name, title, body, image_url, click_url, tags, is_active, max_impressions_per_user, frequency_cap_hours) VALUES
  (
    'ad000000-0000-0000-0000-000000000001',
    'SmartPak Equine',
    'Spring Sale: 25% Off Supplements',
    'Keep your horse healthy this season with our top-rated joint and digestive supplements. Free shipping on orders over $75.',
    'https://placehold.co/600x300/1a1a2e/06b6d4?text=SmartPak+Sale',
    'https://smartpakequine.com',
    ARRAY['supplements', 'health', 'sale'],
    true, 3, 24
  ),
  (
    'ad000000-0000-0000-0000-000000000002',
    'Dover Saddlery',
    'New Arrivals: Dressage Collection',
    'Explore our curated collection of dressage saddles, bridles, and apparel from top European brands.',
    'https://placehold.co/600x300/1a1a2e/a855f7?text=Dover+Dressage',
    'https://doversaddlery.com',
    ARRAY['dressage', 'tack', 'apparel'],
    true, 3, 24
  ),
  (
    'ad000000-0000-0000-0000-000000000003',
    'Riding Warehouse',
    'Trail Riding Essentials',
    'Everything you need for your next trail adventure. Saddle bags, fly gear, and more.',
    'https://placehold.co/600x300/1a1a2e/22c55e?text=Trail+Essentials',
    'https://ridingwarehouse.com',
    ARRAY['trail', 'western', 'gear'],
    true, 5, 48
  ),
  (
    'ad000000-0000-0000-0000-000000000004',
    'Equinti Pro',
    'Upgrade to Equinti Pro',
    'Unlock AI-powered training analysis, unlimited video uploads, and premium challenges.',
    NULL,
    'https://equinti.com/pro',
    ARRAY['training', 'ai', 'premium'],
    true, 2, 72
  );

-- ============================================================================
-- SAMPLE USER BLOCKS (rider3 blocks rider2)
-- ============================================================================
INSERT INTO user_blocks (blocker_id, blocked_id, block_type) VALUES
  ('a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000004', 'mute')
ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

-- ============================================================================
-- SAMPLE SEEN ITEMS (rider1 has seen a few things recently)
-- ============================================================================
-- These would normally be tracked in real-time, but let's seed a few
-- so the cooldown logic has data to work with.
INSERT INTO user_seen_items (user_id, item_id, item_type, seen_at) VALUES
  ('a0000000-0000-0000-0000-000000000003', 'ad000000-0000-0000-0000-000000000001', 'ad', NOW() - INTERVAL '2 hours'),
  ('a0000000-0000-0000-0000-000000000003', 'ad000000-0000-0000-0000-000000000001', 'ad', NOW() - INTERVAL '6 hours'),
  ('a0000000-0000-0000-0000-000000000003', 'ad000000-0000-0000-0000-000000000004', 'ad', NOW() - INTERVAL '1 hour')
ON CONFLICT DO NOTHING;
