-- ============================================================================
-- Seidou Social — initial schema
-- ============================================================================
--
-- Generated with `drizzle-kit generate`, then hand-edited in ONE place:
-- drizzle emitted `CREATE TABLE "users" (...)` because it has no migration
-- history and cannot know that table already exists. That statement was
-- replaced with the ALTER TABLE block below. Everything else is as generated.
--
-- Run this in the Supabase SQL editor. Do NOT run `drizzle-kit push` against
-- a live database — it diffs declared-vs-actual and can propose dropping
-- commerce columns.
--
-- Wrapped in a transaction: if any statement fails, nothing is applied.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Extend the EXISTING users table (shared with the commerce app).
--    Additive only. No existing column is touched, renamed, or dropped.
-- ---------------------------------------------------------------------------

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_url   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS banner_url   text,
  ADD COLUMN IF NOT EXISTS banner_key   text,
  ADD COLUMN IF NOT EXISTS created_at   timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();

-- Backfill display names: "Firstname Lastname", else the email local-part.
UPDATE public.users
   SET display_name = btrim(coalesce(firstname, '') || ' ' || coalesce(lastname, ''))
 WHERE btrim(coalesce(firstname, '') || ' ' || coalesce(lastname, '')) <> '';

UPDATE public.users
   SET display_name = split_part(coalesce(email, 'user'), '@', 1)
 WHERE btrim(display_name) = '';

-- ---------------------------------------------------------------------------
-- 2. Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "public"."reaction_type" AS ENUM('like', 'dislike');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."video_visibility" AS ENUM('private', 'public');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 3. New social tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);

CREATE TABLE IF NOT EXISTS "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"mux_status" text,
	"mux_asset_id" text,
	"mux_upload_id" text,
	"mux_playback_id" text,
	"mux_track_id" text,
	"mux_track_status" text,
	"thumbnail_url" text,
	"thumbnail_key" text,
	"preview_url" text,
	"preview_key" text,
	"duration" integer DEFAULT 0 NOT NULL,
	"visibility" "video_visibility" DEFAULT 'private' NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "videos_mux_asset_id_unique" UNIQUE("mux_asset_id"),
	CONSTRAINT "videos_mux_upload_id_unique" UNIQUE("mux_upload_id"),
	CONSTRAINT "videos_mux_playback_id_unique" UNIQUE("mux_playback_id"),
	CONSTRAINT "videos_mux_track_id_unique" UNIQUE("mux_track_id")
);

CREATE TABLE IF NOT EXISTS "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"user_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comment_reactions" (
	"user_id" uuid NOT NULL,
	"comment_id" uuid NOT NULL,
	"type" "reaction_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "comment_reactions_pk" PRIMARY KEY("user_id","comment_id")
);

CREATE TABLE IF NOT EXISTS "video_reactions" (
	"user_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"type" "reaction_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "video_reactions_pk" PRIMARY KEY("user_id","video_id")
);

CREATE TABLE IF NOT EXISTS "video_views" (
	"user_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "video_views_pk" PRIMARY KEY("user_id","video_id")
);

CREATE TABLE IF NOT EXISTS "subscriptions" (
	"viewer_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_pk" PRIMARY KEY("viewer_id","creator_id")
);

-- ---------------------------------------------------------------------------
-- 4. Foreign keys
-- ---------------------------------------------------------------------------

ALTER TABLE "videos" ADD CONSTRAINT "videos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "videos" ADD CONSTRAINT "videos_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "comments" ADD CONSTRAINT "comments_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "video_reactions" ADD CONSTRAINT "video_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "video_reactions" ADD CONSTRAINT "video_reactions_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "video_views" ADD CONSTRAINT "video_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "video_views" ADD CONSTRAINT "video_views_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "name_idx" ON "categories" USING btree ("name");

-- ---------------------------------------------------------------------------
-- 5. Row Level Security — deny all
-- ---------------------------------------------------------------------------
--
-- The app reaches these tables ONLY through Drizzle, which connects as the
-- service role and bypasses RLS. Enabling RLS with zero policies means the
-- anon and authenticated roles — i.e. anything arriving via supabase-js or
-- PostgREST — are denied outright.
--
-- This makes the tRPC layer provably the only way in, rather than merely the
-- intended one. Without it, these tables would be readable by any visitor
-- holding the public anon key.
--
-- public.users is deliberately NOT touched here: it is shared with the
-- commerce app and keeps whatever policies it already has.
-- ---------------------------------------------------------------------------

ALTER TABLE "categories"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "videos"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comments"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comment_reactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "video_reactions"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "video_views"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions"     ENABLE ROW LEVEL SECURITY;

COMMIT;
