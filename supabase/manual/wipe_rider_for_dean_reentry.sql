-- Ops: wipe rider so /train opens Vector setup again.
-- Prefer: ALLOW_DEV_WIPE=true npx dotenv-cli -e .env.local -- npx tsx scripts/wipe-for-vector-setup.ts --confirm
--
-- Or run below in SQL Editor after replacing YOUR_USER_ID
-- (SELECT id FROM profiles WHERE username = 'rhen';)

DELETE FROM session_transcript_segments
WHERE capture_session_id IN (SELECT id FROM capture_sessions WHERE rider_id = 'YOUR_USER_ID');

DELETE FROM session_media_assets
WHERE capture_session_id IN (SELECT id FROM capture_sessions WHERE rider_id = 'YOUR_USER_ID');

DELETE FROM capture_sessions WHERE rider_id = 'YOUR_USER_ID';

DELETE FROM training_sessions WHERE user_id = 'YOUR_USER_ID';

DELETE FROM horse_profiles WHERE user_id = 'YOUR_USER_ID';

UPDATE profiles
SET vector_setup_completed_at = NULL
WHERE id = 'YOUR_USER_ID';
