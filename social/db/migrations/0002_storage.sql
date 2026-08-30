-- ============================================================================
-- Seidou Social — storage bucket for custom thumbnails and channel banners
-- ============================================================================
--
-- Run this in the Supabase SQL editor.
--
-- Unlike the social TABLES, which are deny-all because Drizzle reaches them
-- as the service role, storage is written directly by the browser using the
-- signed-in user's own session. That avoids needing a service-role key in the
-- app at all, but it means the policies below are the real access control:
-- they confine every write to a folder named after the writer's user id.
--
-- Paths are deterministic and overwritten in place:
--   thumbnails/<user-id>/<video-id>.jpg
--   banners/<user-id>/banner.jpg
--
-- so there is never a stale object to clean up. storage.foldername(name)
-- returns the path segments, and [2] is the user-id segment in both cases.
-- ============================================================================

BEGIN;

-- Public bucket: reads are open (thumbnails appear in a public feed), writes
-- are governed by the policies below. 5 MB ceiling, images only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'social',
  'social',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "social_read"   ON storage.objects;
DROP POLICY IF EXISTS "social_insert" ON storage.objects;
DROP POLICY IF EXISTS "social_update" ON storage.objects;
DROP POLICY IF EXISTS "social_delete" ON storage.objects;

-- Anyone may read: these images are rendered in a public feed.
CREATE POLICY "social_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'social');

-- You may only write inside a folder named after your own user id.
CREATE POLICY "social_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'social'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Needed for upsert: replacing your own thumbnail is an UPDATE, not an INSERT.
CREATE POLICY "social_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'social'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "social_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'social'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

COMMIT;
