-- ============================================================================
-- Seidou Social — imported catalogue, explore/category feeds, onboarding
-- ============================================================================
--
-- 1. videos gains the columns an imported (non-Mux) video needs:
--      source_url           where it plays from (YouTube link or a direct file)
--      external_id          the id from the import JSON, so re-importing a file
--                           updates rows instead of duplicating them
--      imported_view_count  the view count the source reported; added on top
--                           of our own video_views count
--      kind                 'video' or 'short', for the category page tabs
--
-- 2. social_profiles holds the social onboarding answers (gender, country,
--    interests) so nothing is added to the shared commerce users table. It
--    also marks the placeholder users that imported channels ("ESPN FC") are
--    stored as, via channel_key.
--
-- 3. Indexes that keep the category feed fast at thousands of videos, plus
--    video_id indexes for the per-row view and reaction counts every feed
--    runs (both tables are keyed user-first, so those counts were full scans).
--
-- BEFORE IMPORTING: placeholder channel users are plain rows in public.users.
-- If public.users.id has a foreign key to auth.users, those inserts will be
-- refused. Check with:
--
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'public.users'::regclass AND contype = 'f';
--
-- Run this in the Supabase SQL editor. Do NOT run `drizzle-kit push` against
-- a live database — it diffs declared-vs-actual and can propose dropping
-- commerce columns from public.users.
--
-- Additive only. Wrapped in a transaction, so a partial failure rolls back.
-- ============================================================================

BEGIN;

DO $$ BEGIN
  CREATE TYPE "public"."video_kind" AS ENUM ('video', 'short');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "source_url" text;
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "external_id" text;
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "imported_view_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "kind" "video_kind" DEFAULT 'video' NOT NULL;

-- Unique, but NULL for every uploaded video — Postgres treats NULLs as distinct.
CREATE UNIQUE INDEX IF NOT EXISTS "videos_external_id_key"
  ON "videos" USING btree ("external_id");

-- Category page, All tab: WHERE category_id = ? ORDER BY created_at, id.
CREATE INDEX IF NOT EXISTS "videos_category_created_idx"
  ON "videos" USING btree ("category_id", "created_at" DESC, "id" DESC)
  WHERE "visibility" = 'public';

-- Category page, Shorts and Videos tabs: the same, narrowed by kind.
CREATE INDEX IF NOT EXISTS "videos_category_kind_created_idx"
  ON "videos" USING btree ("category_id", "kind", "created_at" DESC, "id" DESC)
  WHERE "visibility" = 'public';

CREATE INDEX IF NOT EXISTS "video_views_video_id_idx"
  ON "video_views" USING btree ("video_id");

CREATE INDEX IF NOT EXISTS "video_reactions_video_id_type_idx"
  ON "video_reactions" USING btree ("video_id", "type");

CREATE TABLE IF NOT EXISTS "social_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"gender" text,
	"country" text,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"terms_accepted_at" timestamp with time zone,
	"onboarded_at" timestamp with time zone,
	"channel_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "social_profiles" ADD CONSTRAINT "social_profiles_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "social_profiles_channel_key_key"
  ON "social_profiles" USING btree ("channel_key");

-- Same model as every other social table: RLS on with zero policies, so only
-- the server's service-role connection can reach it.
ALTER TABLE "social_profiles" ENABLE ROW LEVEL SECURITY;

COMMIT;
