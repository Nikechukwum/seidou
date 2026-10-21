-- ============================================================================
-- Seidou Social — imported YouTube videos
-- ============================================================================
--
-- One table behind the import page (/import) and the youtubeVideos
-- procedures. Separate from "videos" on purpose: those are Mux uploads owned
-- by a user, these are references to videos hosted on YouTube.
--
-- "youtube_id" is the identity. Its unique constraint is what makes the
-- import idempotent: the page inserts with ON CONFLICT DO NOTHING, so
-- re-importing an overlapping export skips what is already here.
--
-- Generated with `drizzle-kit generate`, then hand-edited to add IF NOT
-- EXISTS, the transaction and the security block below.
--
-- Run this in the Supabase SQL editor. Do NOT run `drizzle-kit push` against
-- a live database — it diffs declared-vs-actual and can propose dropping
-- commerce columns from public.users.
--
-- Additive only. Wrapped in a transaction, so a partial failure rolls back.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "youtube_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"youtube_id" text NOT NULL,
	"title" text NOT NULL,
	"category" text,
	"channel_name" text,
	"actual_channel_name" text,
	"is_unrelated_channel" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "youtube_videos_youtube_id_unique" UNIQUE("youtube_id"),
	CONSTRAINT "youtube_videos_youtube_id_format" CHECK ("youtube_videos"."youtube_id" ~ '^[A-Za-z0-9_-]{11}$')
);

CREATE INDEX IF NOT EXISTS "youtube_videos_category_idx"
  ON "youtube_videos" USING btree ("category");

CREATE INDEX IF NOT EXISTS "youtube_videos_created_at_idx"
  ON "youtube_videos" USING btree ("created_at");

-- ---------------------------------------------------------------------------
-- Row Level Security — deny all, matching the other social tables.
--
-- Drizzle connects as the service role and bypasses RLS; enabling it with no
-- policies means anything arriving via supabase-js or PostgREST is denied,
-- so the tRPC layer stays the only way in. The grants are revoked as well:
-- writes here are admin-only, so the browser must not reach the table even if
-- a policy is added by mistake later.
-- ---------------------------------------------------------------------------

ALTER TABLE "youtube_videos" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "youtube_videos" FROM anon, authenticated;

COMMIT;
