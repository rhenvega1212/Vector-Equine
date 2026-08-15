-- Create public horse-photos bucket (run in Supabase SQL Editor as project owner).
-- If this errors, create the bucket in Dashboard → Storage → New bucket
--   name: horse-photos, Public: ON

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'horse-photos',
  'horse-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can read own horse photos" ON storage.objects;
DROP POLICY IF EXISTS "Horse photos are publicly accessible" ON storage.objects;
CREATE POLICY "Horse photos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'horse-photos');

DROP POLICY IF EXISTS "Users can upload own horse photos" ON storage.objects;
CREATE POLICY "Users can upload own horse photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'horse-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own horse photos" ON storage.objects;
CREATE POLICY "Users can update own horse photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'horse-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own horse photos" ON storage.objects;
CREATE POLICY "Users can delete own horse photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'horse-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Confirm
SELECT id, name, public FROM storage.buckets WHERE id = 'horse-photos';
