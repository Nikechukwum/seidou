-- ============================================================================
-- Seidou Social — mirror the import pipeline's tables into videos
-- ============================================================================
--
-- The JSON import pipeline (video_import_batches) writes to catalogue_videos,
-- and a separate one writes youtube_videos/youtube_channels. Every feed in the
-- app — home, category pages, search, watch — reads `videos`. This keeps the
-- two in step:
--
--   AFTER INSERT/UPDATE  upsert the matching videos row
--   AFTER DELETE         delete it (unless the other source still has it)
--
-- and backfills every row that already exists.
--
-- Mapping, per source row:
--   external_id   'yt:<youtube id>' — shared by both sources, so one YouTube
--                 video is one row however many times it is listed. Falls
--                 back to 'catalogue:<id>' / 'youtube:<id>' if no id parses.
--   user_id       a placeholder user per channel, found by social_profiles.
--                 channel_key (same slug the import script uses)
--   category_id   categories row matched by name, created if missing
--   thumbnail     YouTube's own hqdefault image for the id
--   created_at    truncated to milliseconds. Feeds page on a (timestamp, id)
--                 cursor that round-trips through a JS Date; a batch sharing
--                 one microsecond now() would otherwise stop after page one.
--
-- The pipeline's columns carry no view count or duration, so those stay 0.
--
-- Trigger errors are downgraded to warnings: a bug here must never block the
-- pipeline's own insert. The backfill at the bottom is NOT protected, so a
-- problem surfaces when this file runs rather than silently later.
--
-- Run in the Supabase SQL editor. Wrapped in a transaction.
-- ============================================================================

BEGIN;

-- Created by 0004; repeated so ON CONFLICT (external_id) below cannot fail.
CREATE UNIQUE INDEX IF NOT EXISTS "videos_external_id_key"
  ON "videos" USING btree ("external_id");

-- "Movies & Shows" -> "movies-shows". Matches toCategorySlug in
-- social/modules/explore/constants.ts, which the import script uses.
CREATE OR REPLACE FUNCTION public.social_slug(t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' from regexp_replace(lower(t), '[^a-z0-9]+', '-', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.social_youtube_id(url text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT substring(url from '(?:[?&]v=|youtu\.be/|/shorts/|/embed/|/live/)([A-Za-z0-9_-]{11})')
$$;

-- The placeholder user standing in for a channel, created on first sight.
CREATE OR REPLACE FUNCTION public.social_channel_user(p_name text, p_avatar text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  k   text := public.social_slug(coalesce(nullif(trim(p_name), ''), 'unknown channel'));
  uid uuid;
BEGIN
  SELECT user_id INTO uid FROM public.social_profiles WHERE channel_key = k;
  IF uid IS NOT NULL THEN
    RETURN uid;
  END IF;

  uid := gen_random_uuid();
  INSERT INTO public.users (id, display_name, avatar_url)
    VALUES (uid, coalesce(nullif(trim(p_name), ''), 'Unknown channel'), coalesce(p_avatar, ''));
  INSERT INTO public.social_profiles (user_id, channel_key)
    VALUES (uid, k)
    ON CONFLICT (channel_key) DO NOTHING;

  IF NOT FOUND THEN
    -- Lost a race with a concurrent insert for the same channel: use theirs.
    DELETE FROM public.users WHERE id = uid;
    SELECT user_id INTO uid FROM public.social_profiles WHERE channel_key = k;
  END IF;

  RETURN uid;
END $$;

CREATE OR REPLACE FUNCTION public.social_category_id(p_name text)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  cid uuid;
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN NULL;
  END IF;

  SELECT id INTO cid FROM public.categories
    WHERE lower(name) = lower(trim(p_name))
       OR public.social_slug(name) = public.social_slug(p_name)
    ORDER BY (lower(name) = lower(trim(p_name))) DESC
    LIMIT 1;

  IF cid IS NULL THEN
    INSERT INTO public.categories (name, description)
      VALUES (trim(p_name), 'Videos related to ' || lower(trim(p_name)))
      ON CONFLICT (name) DO NOTHING;
    SELECT id INTO cid FROM public.categories WHERE name = trim(p_name);
  END IF;

  RETURN cid;
END $$;

-- The shared upsert both sources go through.
CREATE OR REPLACE FUNCTION public.social_upsert_imported_video(
  p_external_id text,
  p_title text,
  p_url text,
  p_youtube_id text,
  p_category text,
  p_channel text,
  p_channel_name text,
  p_actual_channel_name text,
  p_is_unrelated boolean,
  p_import_batch_id uuid,
  p_avatar text,
  p_created_at timestamptz
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  ts timestamp := date_trunc('milliseconds', p_created_at AT TIME ZONE 'UTC');
BEGIN
  INSERT INTO public.videos (
    external_id, title, source_url, video_url, youtube_id, thumbnail_url,
    kind, visibility, user_id, category_id, category,
    channel_name, actual_channel_name, is_unrelated_channel, import_batch_id,
    created_at, updated_at
  ) VALUES (
    p_external_id, p_title, p_url, p_url, p_youtube_id,
    CASE WHEN p_youtube_id IS NOT NULL
      THEN 'https://i.ytimg.com/vi/' || p_youtube_id || '/hqdefault.jpg' END,
    (CASE WHEN p_url ~* '/shorts/' THEN 'short' ELSE 'video' END)::video_kind,
    'public',
    public.social_channel_user(p_channel, p_avatar),
    public.social_category_id(p_category),
    p_category,
    p_channel_name, p_actual_channel_name, coalesce(p_is_unrelated, false), p_import_batch_id,
    ts, ts
  )
  ON CONFLICT (external_id) DO UPDATE SET
    title                = excluded.title,
    source_url           = excluded.source_url,
    video_url            = excluded.video_url,
    youtube_id           = excluded.youtube_id,
    thumbnail_url        = excluded.thumbnail_url,
    kind                 = excluded.kind,
    user_id              = excluded.user_id,
    category_id          = excluded.category_id,
    category             = excluded.category,
    channel_name         = excluded.channel_name,
    actual_channel_name  = excluded.actual_channel_name,
    is_unrelated_channel = excluded.is_unrelated_channel,
    import_batch_id      = excluded.import_batch_id;
END $$;

-- ---------------------------------------------------------------- catalogue_videos

CREATE OR REPLACE FUNCTION public.social_sync_catalogue_row(c public.catalogue_videos)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  yt text := coalesce(c.youtube_id, public.social_youtube_id(c.video_url));
BEGIN
  PERFORM public.social_upsert_imported_video(
    coalesce('yt:' || yt, 'catalogue:' || c.id),
    c.video_title, c.video_url, yt, c.category,
    coalesce(c.actual_channel_name, c.channel_name),
    c.channel_name, c.actual_channel_name, c.is_unrelated_channel, c.import_batch_id,
    NULL, c.created_at
  );
END $$;

CREATE OR REPLACE FUNCTION public.social_catalogue_videos_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  yt  text;
  ext text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    yt  := coalesce(OLD.youtube_id, public.social_youtube_id(OLD.video_url));
    ext := coalesce('yt:' || yt, 'catalogue:' || OLD.id);
    -- Keep it if the other source still lists the same YouTube video.
    IF yt IS NULL OR NOT EXISTS (SELECT 1 FROM public.youtube_videos WHERE youtube_id = yt) THEN
      DELETE FROM public.videos WHERE external_id = ext;
    END IF;
    RETURN OLD;
  END IF;

  PERFORM public.social_sync_catalogue_row(NEW);
  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING 'catalogue_videos -> videos sync failed for %: %', coalesce(NEW.id, OLD.id), SQLERRM;
  RETURN coalesce(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS social_catalogue_videos_sync ON public.catalogue_videos;
CREATE TRIGGER social_catalogue_videos_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.catalogue_videos
  FOR EACH ROW EXECUTE FUNCTION public.social_catalogue_videos_sync();

-- ---------------------------------------------------------------- youtube_videos

CREATE OR REPLACE FUNCTION public.social_sync_youtube_row(v public.youtube_videos)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  ch public.youtube_channels;
BEGIN
  SELECT * INTO ch FROM public.youtube_channels WHERE id = v.channel_id;

  PERFORM public.social_upsert_imported_video(
    'yt:' || v.youtube_id,
    v.title, 'https://www.youtube.com/watch?v=' || v.youtube_id, v.youtube_id, v.category,
    coalesce(ch.name, v.actual_channel_name, v.channel_name),
    v.channel_name, v.actual_channel_name, v.is_unrelated_channel, NULL,
    ch.avatar_url, v.created_at
  );
END $$;

CREATE OR REPLACE FUNCTION public.social_youtube_videos_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.catalogue_videos
      WHERE coalesce(youtube_id, public.social_youtube_id(video_url)) = OLD.youtube_id
    ) THEN
      DELETE FROM public.videos WHERE external_id = 'yt:' || OLD.youtube_id;
    END IF;
    RETURN OLD;
  END IF;

  PERFORM public.social_sync_youtube_row(NEW);
  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING 'youtube_videos -> videos sync failed for %: %', coalesce(NEW.id, OLD.id), SQLERRM;
  RETURN coalesce(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS social_youtube_videos_sync ON public.youtube_videos;
CREATE TRIGGER social_youtube_videos_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.youtube_videos
  FOR EACH ROW EXECUTE FUNCTION public.social_youtube_videos_sync();

-- ---------------------------------------------------------------- lock down

-- None of these are for the public API. Without this, Supabase exposes every
-- function in `public` as an RPC endpoint to anon and signed-in users.
REVOKE EXECUTE ON FUNCTION
  public.social_slug(text),
  public.social_youtube_id(text),
  public.social_channel_user(text, text),
  public.social_category_id(text),
  public.social_upsert_imported_video(text, text, text, text, text, text, text, text, boolean, uuid, text, timestamptz),
  public.social_sync_catalogue_row(public.catalogue_videos),
  public.social_sync_youtube_row(public.youtube_videos),
  public.social_catalogue_videos_sync(),
  public.social_youtube_videos_sync()
FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- backfill

SELECT public.social_sync_catalogue_row(c) FROM public.catalogue_videos c;
SELECT public.social_sync_youtube_row(v) FROM public.youtube_videos v;

COMMIT;
