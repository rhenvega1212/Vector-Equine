-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('avatars', 'avatars', true),
  ('post-media', 'post-media', true),
  ('event-banners', 'event-banners', true),
  ('challenge-media', 'challenge-media', true),
  ('submissions', 'submissions', true);

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Avatars bucket policies
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Post media bucket policies
CREATE POLICY "Post media is publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-media');

CREATE POLICY "Authenticated users can upload post media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'post-media' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their own post media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'post-media' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Event banners bucket policies
CREATE POLICY "Event banners are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-banners');

CREATE POLICY "Event hosts can upload banners"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'event-banners' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Event hosts can delete their banners"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'event-banners' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Challenge media bucket policies
CREATE POLICY "Challenge media is publicly accessible for published challenges"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'challenge-media');

CREATE POLICY "Admins can upload challenge media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'challenge-media' 
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete challenge media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'challenge-media' 
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Submissions bucket policies
CREATE POLICY "Submissions accessible to enrolled users"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'submissions');

CREATE POLICY "Enrolled users can upload submissions"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'submissions' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their own submissions"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'submissions' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
