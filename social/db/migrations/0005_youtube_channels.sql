-- ============================================================================
-- Seidou Social — the channels behind imported YouTube videos
-- ============================================================================
--
-- One row per YouTube channel, so its avatar, banner and counts are stored
-- once instead of on every video. Filled by the import page (/import) from
-- the converter's export, which reads them from a saved channel page.
--
-- "handle" is the identity ("@zeltik"), stored lowercase because YouTube
-- handles are case-insensitive. Re-importing a channel updates its row.
--
-- The avatar and banner are COPIES in the "social" storage bucket, under
-- youtube-channels/<importing admin's user id>/<handle>/ — the existing bucket
-- policies (0002) already allow that path, so no storage change is needed.
--
-- Generated with `drizzle-kit generate`, then hand-edited to add IF NOT
-- EXISTS, the transaction and the security block below.
--
-- Run this in the Supabase SQL editor, after 0004. Do NOT run `drizzle-kit
-- push` against a live database.
--
-- Additive only. Wrapped in a transaction, so a partial failure rolls back.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "youtube_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"subscribers_text" text,
	"video_count_text" text,
	"source_url" text,
	"avatar_url" text,
	"avatar_key" text,
	"banner_url" text,
	"banner_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "youtube_channels_handle_unique" UNIQUE("handle"),
	CONSTRAINT "youtube_channels_handle_format" CHECK ("youtube_channels"."handle" ~ '^@[^[:space:][:upper:]]+$')
);

-- Each video points at its channel. Nullable: older imports and videos from
-- an unrelated channel have none.
ALTER TABLE "youtube_videos" ADD COLUMN IF NOT EXISTS "channel_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'youtube_videos_channel_id_youtube_channels_id_fk'
  ) THEN
    ALTER TABLE "youtube_videos"
      ADD CONSTRAINT "youtube_videos_channel_id_youtube_channels_id_fk"
      FOREIGN KEY ("channel_id") REFERENCES "public"."youtube_channels"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "youtube_videos_channel_id_idx"
  ON "youtube_videos" USING btree ("channel_id");

-- ---------------------------------------------------------------------------
-- Row Level Security — deny all, like youtube_videos. Drizzle connects as the
-- service role and bypasses RLS; the browser must not reach the table.
-- ---------------------------------------------------------------------------

ALTER TABLE "youtube_channels" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "youtube_channels" FROM anon, authenticated;

COMMIT;
