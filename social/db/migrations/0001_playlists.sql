-- ============================================================================
-- Seidou Social — playlists
-- ============================================================================
--
-- Adds the two tables user-made playlists need. Watch history and liked
-- videos need nothing here: they are derived from video_views and
-- video_reactions, which v1 already populates.
--
-- Run this in the Supabase SQL editor. Do NOT run `drizzle-kit push` against
-- a live database — it diffs declared-vs-actual and can propose dropping
-- commerce columns from public.users.
--
-- Additive only. Wrapped in a transaction, so a partial failure rolls back.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "playlist_videos" (
	"playlist_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "playlist_videos_pk" PRIMARY KEY("playlist_id","video_id")
);

-- Deleting a user removes their playlists; deleting a video removes it from
-- every playlist it appears in.
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "playlist_videos" ADD CONSTRAINT "playlist_videos_playlist_id_playlists_id_fk"
  FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "playlist_videos" ADD CONSTRAINT "playlist_videos_video_id_videos_id_fk"
  FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id")
  ON DELETE cascade ON UPDATE no action;

-- ---------------------------------------------------------------------------
-- Row Level Security — deny all, matching the other social tables.
--
-- Drizzle connects as the service role and bypasses RLS; enabling it with no
-- policies means anything arriving via supabase-js or PostgREST is denied,
-- so the tRPC layer stays the only way in.
-- ---------------------------------------------------------------------------

ALTER TABLE "playlists"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "playlist_videos" ENABLE ROW LEVEL SECURITY;

COMMIT;
