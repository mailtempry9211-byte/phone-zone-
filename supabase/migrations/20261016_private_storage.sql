-- Make the uploads bucket PRIVATE (online / Supabase mode only).
--
-- Run this in the Supabase SQL editor (or `supabase db push`). Do NOT run it
-- against the local SQLite backend - it only affects the hosted project.
--
-- Why: `phonezone-uploads` was created with public = true and four "Allow
-- public ..." policies that let ANYONE holding the anon key (which ships inside
-- the browser bundle) read, overwrite and DELETE every object in the bucket -
-- including Aadhaar copies, purchase bills and payment screenshots.
--
-- Existing public URLs of private documents will STOP working after this runs.
-- Use signed URLs (supabase.storage.from('phonezone-uploads').createSignedUrl)
-- for private files. Product photos that must stay public should live in a
-- separate public bucket instead of this one.

-- 1. Bucket is no longer world-readable.
UPDATE storage.buckets SET public = false WHERE id = 'phonezone-uploads';

-- 2. Drop the four anonymous policies.
DROP POLICY IF EXISTS "Allow public uploads"   ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates"   ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes"   ON storage.objects;

-- 3. Only signed-in users may touch objects in this bucket.
DROP POLICY IF EXISTS "Authenticated uploads"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated downloads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated updates"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated deletes"   ON storage.objects;

CREATE POLICY "Authenticated uploads" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'phonezone-uploads');

CREATE POLICY "Authenticated downloads" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'phonezone-uploads');

CREATE POLICY "Authenticated updates" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'phonezone-uploads')
  WITH CHECK (bucket_id = 'phonezone-uploads');

CREATE POLICY "Authenticated deletes" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'phonezone-uploads');
