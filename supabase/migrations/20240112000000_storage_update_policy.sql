-- Add UPDATE policy for challenge-media so admins can replace files
CREATE POLICY "Admins can update challenge media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'challenge-media'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
