-- ============================================================================
-- BOT ACCOUNTS FOR CONTENT SEEDING
-- ============================================================================
-- These accounts are used by the automated seeding system to create
-- realistic-looking posts and engagement. They are standard rider profiles
-- with no special flags or indicators.

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, role
) VALUES
  (
    '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    '00000000-0000-0000-0000-000000000000',
    'jessicam.trails@gmail.com',
    crypt('password123', gen_salt('bf')),
    NOW() - INTERVAL '47 days',
    NOW() - INTERVAL '47 days',
    NOW() - INTERVAL '47 days',
    '{"provider": "email", "providers": ["email"]}',
    '{}', FALSE, 'authenticated'
  ),
  (
    '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    '00000000-0000-0000-0000-000000000000',
    'oliver.chen.rides@outlook.com',
    crypt('password123', gen_salt('bf')),
    NOW() - INTERVAL '62 days',
    NOW() - INTERVAL '62 days',
    NOW() - INTERVAL '62 days',
    '{"provider": "email", "providers": ["email"]}',
    '{}', FALSE, 'authenticated'
  ),
  (
    '1b4e28ba-2fa1-4d21-b7f8-71a26fbb5c76',
    '00000000-0000-0000-0000-000000000000',
    'hannahbrooks92@gmail.com',
    crypt('password123', gen_salt('bf')),
    NOW() - INTERVAL '35 days',
    NOW() - INTERVAL '35 days',
    NOW() - INTERVAL '35 days',
    '{"provider": "email", "providers": ["email"]}',
    '{}', FALSE, 'authenticated'
  ),
  (
    '9e107d9d-372b-4a8a-80f2-e9e15d24a06b',
    '00000000-0000-0000-0000-000000000000',
    'ryan.osullivan@icloud.com',
    crypt('password123', gen_salt('bf')),
    NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '28 days',
    '{"provider": "email", "providers": ["email"]}',
    '{}', FALSE, 'authenticated'
  ),
  (
    '6ba7b810-9dad-41d4-80b5-72c26d5a9f9e',
    '00000000-0000-0000-0000-000000000000',
    'sophia.equine@outlook.com',
    crypt('password123', gen_salt('bf')),
    NOW() - INTERVAL '55 days',
    NOW() - INTERVAL '55 days',
    NOW() - INTERVAL '55 days',
    '{"provider": "email", "providers": ["email"]}',
    '{}', FALSE, 'authenticated'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440012',
    '00000000-0000-0000-0000-000000000000',
    'marcus.w.rides@gmail.com',
    crypt('password123', gen_salt('bf')),
    NOW() - INTERVAL '41 days',
    NOW() - INTERVAL '41 days',
    NOW() - INTERVAL '41 days',
    '{"provider": "email", "providers": ["email"]}',
    '{}', FALSE, 'authenticated'
  ),
  (
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    '00000000-0000-0000-0000-000000000000',
    'lily.patel.eventing@yahoo.com',
    crypt('password123', gen_salt('bf')),
    NOW() - INTERVAL '53 days',
    NOW() - INTERVAL '53 days',
    NOW() - INTERVAL '53 days',
    '{"provider": "email", "providers": ["email"]}',
    '{}', FALSE, 'authenticated'
  ),
  (
    '8a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d',
    '00000000-0000-0000-0000-000000000000',
    'jamescooper.eq@gmail.com',
    crypt('password123', gen_salt('bf')),
    NOW() - INTERVAL '39 days',
    NOW() - INTERVAL '39 days',
    NOW() - INTERVAL '39 days',
    '{"provider": "email", "providers": ["email"]}',
    '{}', FALSE, 'authenticated'
  ),
  (
    '2d4e6f8a-1b3c-4d5e-a6f7-8a9b0c1d2e3f',
    '00000000-0000-0000-0000-000000000000',
    'natalie.kim.trails@outlook.com',
    crypt('password123', gen_salt('bf')),
    NOW() - INTERVAL '22 days',
    NOW() - INTERVAL '22 days',
    NOW() - INTERVAL '22 days',
    '{"provider": "email", "providers": ["email"]}',
    '{}', FALSE, 'authenticated'
  ),
  (
    'b5c7d9e1-f3a5-4b7d-9e1f-3a5b7d9e1f3a',
    '00000000-0000-0000-0000-000000000000',
    'danielreeves.dr@gmail.com',
    crypt('password123', gen_salt('bf')),
    NOW() - INTERVAL '44 days',
    NOW() - INTERVAL '44 days',
    NOW() - INTERVAL '44 days',
    '{"provider": "email", "providers": ["email"]}',
    '{}', FALSE, 'authenticated'
  );

-- Identities
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at) VALUES
  ('3fa85f64-5717-4562-b3fc-2c963f66afa6', '3fa85f64-5717-4562-b3fc-2c963f66afa6', '{"sub": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "email": "jessicam.trails@gmail.com"}', 'email', '3fa85f64-5717-4562-b3fc-2c963f66afa6', NOW(), NOW(), NOW()),
  ('7c9e6679-7425-40de-944b-e07fc1f90ae7', '7c9e6679-7425-40de-944b-e07fc1f90ae7', '{"sub": "7c9e6679-7425-40de-944b-e07fc1f90ae7", "email": "oliver.chen.rides@outlook.com"}', 'email', '7c9e6679-7425-40de-944b-e07fc1f90ae7', NOW(), NOW(), NOW()),
  ('1b4e28ba-2fa1-4d21-b7f8-71a26fbb5c76', '1b4e28ba-2fa1-4d21-b7f8-71a26fbb5c76', '{"sub": "1b4e28ba-2fa1-4d21-b7f8-71a26fbb5c76", "email": "hannahbrooks92@gmail.com"}', 'email', '1b4e28ba-2fa1-4d21-b7f8-71a26fbb5c76', NOW(), NOW(), NOW()),
  ('9e107d9d-372b-4a8a-80f2-e9e15d24a06b', '9e107d9d-372b-4a8a-80f2-e9e15d24a06b', '{"sub": "9e107d9d-372b-4a8a-80f2-e9e15d24a06b", "email": "ryan.osullivan@icloud.com"}', 'email', '9e107d9d-372b-4a8a-80f2-e9e15d24a06b', NOW(), NOW(), NOW()),
  ('6ba7b810-9dad-41d4-80b5-72c26d5a9f9e', '6ba7b810-9dad-41d4-80b5-72c26d5a9f9e', '{"sub": "6ba7b810-9dad-41d4-80b5-72c26d5a9f9e", "email": "sophia.equine@outlook.com"}', 'email', '6ba7b810-9dad-41d4-80b5-72c26d5a9f9e', NOW(), NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440012', '{"sub": "550e8400-e29b-41d4-a716-446655440012", "email": "marcus.w.rides@gmail.com"}', 'email', '550e8400-e29b-41d4-a716-446655440012', NOW(), NOW(), NOW()),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', '{"sub": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "email": "lily.patel.eventing@yahoo.com"}', 'email', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', NOW(), NOW(), NOW()),
  ('8a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', '8a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', '{"sub": "8a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d", "email": "jamescooper.eq@gmail.com"}', 'email', '8a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', NOW(), NOW(), NOW()),
  ('2d4e6f8a-1b3c-4d5e-a6f7-8a9b0c1d2e3f', '2d4e6f8a-1b3c-4d5e-a6f7-8a9b0c1d2e3f', '{"sub": "2d4e6f8a-1b3c-4d5e-a6f7-8a9b0c1d2e3f", "email": "natalie.kim.trails@outlook.com"}', 'email', '2d4e6f8a-1b3c-4d5e-a6f7-8a9b0c1d2e3f', NOW(), NOW(), NOW()),
  ('b5c7d9e1-f3a5-4b7d-9e1f-3a5b7d9e1f3a', 'b5c7d9e1-f3a5-4b7d-9e1f-3a5b7d9e1f3a', '{"sub": "b5c7d9e1-f3a5-4b7d-9e1f-3a5b7d9e1f3a", "email": "danielreeves.dr@gmail.com"}', 'email', 'b5c7d9e1-f3a5-4b7d-9e1f-3a5b7d9e1f3a', NOW(), NOW(), NOW());

-- Profiles
INSERT INTO profiles (id, email, username, display_name, bio, location, discipline, rider_level, role) VALUES
  ('3fa85f64-5717-4562-b3fc-2c963f66afa6', 'jessicam.trails@gmail.com', 'jessicamtrails', 'Jessica Martinez', 'Desert trail rider and barrel racer. My quarter horse Rio is my best friend.', 'Scottsdale, AZ', 'western', 'intermediate', 'rider'),
  ('7c9e6679-7425-40de-944b-e07fc1f90ae7', 'oliver.chen.rides@outlook.com', 'oliverrides', 'Oliver Chen', 'Working toward Grand Prix dressage. It''s a marathon, not a sprint.', 'Aiken, SC', 'dressage', 'advanced', 'rider'),
  ('1b4e28ba-2fa1-4d21-b7f8-71a26fbb5c76', 'hannahbrooks92@gmail.com', 'hannahb_equine', 'Hannah Brooks', 'Eventer with two OTTBs. Embracing the chaos one cross-country course at a time.', 'Middleburg, VA', 'eventing', 'intermediate', 'rider'),
  ('9e107d9d-372b-4a8a-80f2-e9e15d24a06b', 'ryan.osullivan@icloud.com', 'ryano_rides', 'Ryan O''Sullivan', 'New to the hunter/jumper world. Learning every day and loving it.', 'Greenwich, CT', 'jumping', 'beginner', 'rider'),
  ('6ba7b810-9dad-41d4-80b5-72c26d5a9f9e', 'sophia.equine@outlook.com', 'sophiaeq', 'Sophia Andersson', 'Swedish-American dressage rider. PSG level with my Hanoverian mare Freya.', 'Wellington, FL', 'dressage', 'advanced', 'rider'),
  ('550e8400-e29b-41d4-a716-446655440012', 'marcus.w.rides@gmail.com', 'marcuswrides', 'Marcus Williams', 'Reiner and ranch rider. Nothing beats a good cow horse.', 'Fort Worth, TX', 'western', 'intermediate', 'rider'),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'lily.patel.eventing@yahoo.com', 'lilyp_eventing', 'Lily Patel', 'Preliminary eventer, vet tech, and horse mom x3. Always learning.', 'Lexington, KY', 'eventing', 'advanced', 'rider'),
  ('8a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', 'jamescooper.eq@gmail.com', 'jcooper_eq', 'James Cooper', 'Jumper rider aiming for the 1.20m. My KWPN gelding Atlas and I are a team.', 'Ocala, FL', 'jumping', 'intermediate', 'rider'),
  ('2d4e6f8a-1b3c-4d5e-a6f7-8a9b0c1d2e3f', 'natalie.kim.trails@outlook.com', 'natkim_trails', 'Natalie Kim', 'Pacific NW trail rider. Just started last year and already hooked.', 'Bend, OR', 'western', 'beginner', 'rider'),
  ('b5c7d9e1-f3a5-4b7d-9e1f-3a5b7d9e1f3a', 'danielreeves.dr@gmail.com', 'dreeves_dressage', 'Daniel Reeves', 'British dressage enthusiast. Medium level competitor with my Irish cob.', 'Newbury, UK', 'dressage', 'intermediate', 'rider');

-- Cross-follows between bots and existing seed users for realism
INSERT INTO follows (follower_id, following_id) VALUES
  ('3fa85f64-5717-4562-b3fc-2c963f66afa6', 'a0000000-0000-0000-0000-000000000002'),
  ('7c9e6679-7425-40de-944b-e07fc1f90ae7', 'a0000000-0000-0000-0000-000000000002'),
  ('1b4e28ba-2fa1-4d21-b7f8-71a26fbb5c76', 'a0000000-0000-0000-0000-000000000003'),
  ('9e107d9d-372b-4a8a-80f2-e9e15d24a06b', 'a0000000-0000-0000-0000-000000000004'),
  ('6ba7b810-9dad-41d4-80b5-72c26d5a9f9e', 'a0000000-0000-0000-0000-000000000002'),
  ('550e8400-e29b-41d4-a716-446655440012', 'a0000000-0000-0000-0000-000000000005'),
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'a0000000-0000-0000-0000-000000000003'),
  ('3fa85f64-5717-4562-b3fc-2c963f66afa6', '550e8400-e29b-41d4-a716-446655440012'),
  ('7c9e6679-7425-40de-944b-e07fc1f90ae7', '6ba7b810-9dad-41d4-80b5-72c26d5a9f9e'),
  ('1b4e28ba-2fa1-4d21-b7f8-71a26fbb5c76', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
  ('9e107d9d-372b-4a8a-80f2-e9e15d24a06b', '8a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d'),
  ('2d4e6f8a-1b3c-4d5e-a6f7-8a9b0c1d2e3f', '3fa85f64-5717-4562-b3fc-2c963f66afa6'),
  ('b5c7d9e1-f3a5-4b7d-9e1f-3a5b7d9e1f3a', '7c9e6679-7425-40de-944b-e07fc1f90ae7');
