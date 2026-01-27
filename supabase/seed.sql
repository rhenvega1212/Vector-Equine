-- ============================================================================
-- SEED DATA FOR LOCAL DEVELOPMENT
-- ============================================================================
-- Note: This seed file creates test data for local development.
-- In production, user creation happens through Supabase Auth.

-- First, we need to create users in auth.users
-- These are test users for development only

-- Insert test users (passwords are 'password123' for all)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES
  -- Admin user
  (
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'admin@equinti.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    FALSE,
    'authenticated'
  ),
  -- Trainer user (approved)
  (
    'a0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'trainer@equinti.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    FALSE,
    'authenticated'
  ),
  -- Regular rider users
  (
    'a0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'rider1@equinti.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    FALSE,
    'authenticated'
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'rider2@equinti.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    FALSE,
    'authenticated'
  ),
  (
    'a0000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'rider3@equinti.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    FALSE,
    'authenticated'
  );

-- Insert identities for the users
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '{"sub": "a0000000-0000-0000-0000-000000000001", "email": "admin@equinti.com"}', 'email', 'a0000000-0000-0000-0000-000000000001', NOW(), NOW(), NOW()),
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', '{"sub": "a0000000-0000-0000-0000-000000000002", "email": "trainer@equinti.com"}', 'email', 'a0000000-0000-0000-0000-000000000002', NOW(), NOW(), NOW()),
  ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', '{"sub": "a0000000-0000-0000-0000-000000000003", "email": "rider1@equinti.com"}', 'email', 'a0000000-0000-0000-0000-000000000003', NOW(), NOW(), NOW()),
  ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', '{"sub": "a0000000-0000-0000-0000-000000000004", "email": "rider2@equinti.com"}', 'email', 'a0000000-0000-0000-0000-000000000004', NOW(), NOW(), NOW()),
  ('a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', '{"sub": "a0000000-0000-0000-0000-000000000005", "email": "rider3@equinti.com"}', 'email', 'a0000000-0000-0000-0000-000000000005', NOW(), NOW(), NOW());

-- Create profiles for test users
INSERT INTO profiles (id, email, username, display_name, bio, location, discipline, rider_level, role, trainer_approved, trainer_approved_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin@equinti.com', 'admin', 'Equinti Admin', 'Platform administrator and equestrian enthusiast.', 'San Francisco, CA', 'dressage', 'professional', 'admin', FALSE, NULL),
  ('a0000000-0000-0000-0000-000000000002', 'trainer@equinti.com', 'sarahjohnson', 'Sarah Johnson', 'Professional dressage trainer with 15 years of experience. Passionate about helping riders achieve their goals.', 'Wellington, FL', 'dressage', 'professional', 'trainer', TRUE, NOW()),
  ('a0000000-0000-0000-0000-000000000003', 'rider1@equinti.com', 'alexrider', 'Alex Thompson', 'Weekend warrior eventer. Love my horse Luna!', 'Lexington, KY', 'eventing', 'intermediate', 'rider', FALSE, NULL),
  ('a0000000-0000-0000-0000-000000000004', 'rider2@equinti.com', 'emmawilson', 'Emma Wilson', 'Hunter/jumper rider working towards my goals. Always learning!', 'Ocala, FL', 'jumping', 'beginner', 'rider', FALSE, NULL),
  ('a0000000-0000-0000-0000-000000000005', 'rider3@equinti.com', 'mikebrown', 'Mike Brown', 'Western pleasure and trail riding. Love the outdoors!', 'Austin, TX', 'western', 'advanced', 'rider', FALSE, NULL);

-- Create some follows
INSERT INTO follows (follower_id, following_id) VALUES
  ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002'), -- Alex follows Sarah
  ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002'), -- Emma follows Sarah
  ('a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002'), -- Mike follows Sarah
  ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004'), -- Alex follows Emma
  ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003'); -- Emma follows Alex

-- Create some posts
INSERT INTO posts (id, author_id, content, tags) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Just finished an amazing training session with my students! So proud of their progress this month. Remember: every ride is a chance to improve. 🐴', ARRAY['training', 'dressage', 'mindset']),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'Luna and I had our first clear round at the local schooling show! All those early mornings are paying off.', ARRAY['eventing', 'show', 'jumping']),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', 'Any tips for a nervous horse at competitions? My boy gets so anxious in new environments.', ARRAY['horse-care', 'mindset', 'competition']),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000005', 'Beautiful trail ride today through the hill country. Nothing beats Texas sunsets on horseback!', ARRAY['western', 'trail-riding']),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'New blog post: "5 Exercises to Improve Your Horse''s Topline" - link in my profile! 📚', ARRAY['training', 'dressage', 'horse-care']);

-- Create some likes
INSERT INTO post_likes (user_id, post_id) VALUES
  ('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004');

-- Create some comments
INSERT INTO comments (id, post_id, author_id, content) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'Such an inspiration! Can''t wait for our next lesson.'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Congratulations Alex! Your hard work is really showing. Keep it up! 🎉'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Great question! Try arriving early to let him settle. Hand walking and grazing can help. Also, consider bringing a buddy horse if possible.'),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005', 'I use calming supplements for mine. Works wonders! Happy to share what brand.'),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', 'Gorgeous! Texas trails look amazing.');

-- Create some events
INSERT INTO events (id, host_id, title, description, event_type, location_city, location_state, location_address, start_time, end_time, capacity, price_display, is_published) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Dressage Fundamentals Clinic', 'Join me for a day of focused dressage training. We''ll cover the basics of collection, straightness, and rhythm. Suitable for Training through Second Level riders.', 'clinic', 'Wellington', 'FL', '123 Equestrian Way', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days' + INTERVAL '6 hours', 12, '$150/rider', TRUE),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Evening Lecture: Mental Preparation for Competition', 'An interactive lecture on mental strategies for competition success. Learn visualization techniques and how to manage competition nerves.', 'networking', 'Wellington', 'FL', 'Palm Beach Equine Center', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '2 hours', 30, 'Free', TRUE),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Equinti Community Movie Night', 'Join fellow equestrians for a screening of "Buck" followed by discussion. Snacks provided!', 'movie_night', 'San Francisco', 'CA', 'Equinti HQ', NOW() + INTERVAL '21 days', NOW() + INTERVAL '21 days' + INTERVAL '3 hours', 50, 'Free', TRUE);

-- Create some RSVPs
INSERT INTO event_rsvps (user_id, event_id, status) VALUES
  ('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'going'),
  ('a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'interested'),
  ('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'going'),
  ('a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'going'),
  ('a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 'interested');

-- Create a sample challenge
INSERT INTO challenges (id, creator_id, title, description, difficulty, duration_days, price_display, status, is_private) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '30-Day Groundwork Challenge', 'Build a stronger bond with your horse through daily groundwork exercises. This challenge will take you through progressively more advanced exercises, from basic leading to liberty work.', 'beginner', 30, 'Free', 'published', FALSE);

-- Create modules for the challenge
INSERT INTO challenge_modules (id, challenge_id, title, description, sort_order) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Week 1: Foundation', 'Establish the basics of groundwork communication.', 0),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Week 2: Building Respect', 'Develop mutual respect and clearer boundaries.', 1),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Week 3: Advanced Movement', 'Introduction to lateral movements and circling.', 2),
  ('f0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'Week 4: Liberty Foundations', 'Begin working towards liberty exercises.', 3);

-- Create lessons for the first module
INSERT INTO challenge_lessons (id, module_id, title, description, requires_submission, sort_order) VALUES
  ('aa000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Introduction to Groundwork', 'Learn why groundwork is essential and what equipment you''ll need.', FALSE, 0),
  ('aa000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'Leading Basics', 'Master the art of leading with purpose and intention.', TRUE, 1),
  ('aa000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 'Halting and Standing', 'Teach your horse to halt promptly and stand quietly.', TRUE, 2),
  ('aa000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', 'Backing Up', 'Learn to ask your horse to back up with lightness.', TRUE, 3),
  ('aa000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000001', 'Week 1 Reflection', 'Reflect on your progress this week.', TRUE, 4);

-- Create content blocks for the first lesson
INSERT INTO lesson_content_blocks (id, lesson_id, block_type, content, sort_order) VALUES
  ('bb000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 'rich_text', '# Welcome to the 30-Day Groundwork Challenge!

Groundwork is the foundation of all horse training. It establishes communication, trust, and respect between you and your horse. In this challenge, we''ll build skills progressively, starting with the basics and working towards more advanced exercises.

## Why Groundwork Matters

- **Safety**: A well-trained ground horse is safer to handle
- **Communication**: Establish clear signals before riding
- **Bond**: Strengthen your relationship with your horse
- **Problem-solving**: Address behavioral issues from the ground

## What You''ll Need

1. A well-fitting halter (rope halter recommended)
2. A 12-14 foot lead rope
3. A lunge whip or training stick (optional)
4. A safe, enclosed space to work

Let''s get started on this journey together!', 0),
  ('bb000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000001', 'video', 'https://example.com/videos/groundwork-intro.mp4', 1),
  ('bb000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000001', 'rich_text', '## Key Principles

1. **Consistency**: Use the same cues every time
2. **Timing**: Release pressure the moment your horse responds
3. **Feel**: Develop sensitivity to your horse''s responses
4. **Patience**: Progress takes time - celebrate small wins!', 2);

-- Create an assignment for the leading basics lesson
INSERT INTO assignments (id, lesson_id, title, instructions, submission_type) VALUES
  ('cc000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000002', 'Leading Practice Video', 'Record a short video (1-2 minutes) showing you leading your horse through a simple course: walk forward, halt, walk again, turn left, turn right, and halt. Share what went well and what you''d like to improve.', 'video'),
  ('cc000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000003', 'Halting Exercise', 'Take a photo of your horse standing quietly on a loose lead after practicing halting. Write a brief description of how long they stood before fidgeting.', 'image'),
  ('cc000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000004', 'Backing Up Progress', 'Share a video or description of your backing up practice. How many steps can your horse back up smoothly?', 'text'),
  ('cc000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000005', 'Week 1 Reflection', 'Write about your experience this week. What was easy? What was challenging? What did you learn about your horse?', 'text');

-- Create some enrollments
INSERT INTO challenge_enrollments (id, user_id, challenge_id) VALUES
  ('dd000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001'),
  ('dd000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001');

-- Create some lesson completions
INSERT INTO lesson_completions (user_id, lesson_id) VALUES
  ('a0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000001');

-- Create a sample submission
INSERT INTO submissions (id, assignment_id, user_id, content, admin_feedback, is_feedback_pinned) VALUES
  ('ee000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'Here''s my leading practice! Luna was a bit distracted at first but settled in nicely. The turns were tricky - she kept cutting corners. Any tips?', 'Great first attempt, Alex! I can see Luna is starting to understand. For the corners, try using a slightly longer lead and positioning your body more to the outside of the turn. This will encourage her to take a wider arc. Keep up the good work!', TRUE);
