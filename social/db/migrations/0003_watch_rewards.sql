-- ============================================================================
-- Seidou Social — watch-time loyalty rewards
-- ============================================================================
--
-- Two server-only tables behind the watchRewards.heartbeat procedure:
--
--   watch_reward_progress  One row per user: the heartbeat clock, watched time
--                          toward the next reward, and the current reward
--                          window. The window opens with the first reward and
--                          fully resets 24 hours later.
--   watch_reward_grants    One row per reward granted. An audit log only; the
--                          cap is enforced from watch_reward_progress.
--
-- Every time column is timestamptz written with Postgres now(), so it is UTC
-- and never comes from the browser.
--
-- Run this in the Supabase SQL editor. Do NOT run `drizzle-kit push` against
-- a live database — it diffs declared-vs-actual and can propose dropping
-- commerce columns from public.users.
--
-- Additive only. Wrapped in a transaction, so a partial failure rolls back.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "watch_reward_progress" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"progress_ms" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone,
	"window_grants" integer DEFAULT 0 NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"last_video_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_reward_progress_progress_ms_nonneg" CHECK ("progress_ms" >= 0),
	CONSTRAINT "watch_reward_progress_window_grants_nonneg" CHECK ("window_grants" >= 0)
);

CREATE TABLE IF NOT EXISTS "watch_reward_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reward_id" bigint NOT NULL,
	"amount" integer NOT NULL,
	"video_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Deleting a user removes their reward state. last_video_id and video_id have
-- no FK on purpose: they are diagnostic, and deleting a video must not touch
-- reward history.
ALTER TABLE "watch_reward_progress" ADD CONSTRAINT "watch_reward_progress_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "watch_reward_grants" ADD CONSTRAINT "watch_reward_grants_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "watch_reward_grants_user_granted_at_idx"
  ON "watch_reward_grants" USING btree ("user_id", "granted_at");

-- ---------------------------------------------------------------------------
-- Row Level Security — deny all, matching the other social tables.
--
-- Drizzle connects as the service role and bypasses RLS; enabling it with no
-- policies means anything arriving via supabase-js or PostgREST is denied.
-- The table grants are revoked as well: these rows decide who gets paid, so
-- the browser must not be able to read or write them even if a policy is
-- added by mistake later.
-- ---------------------------------------------------------------------------

ALTER TABLE "watch_reward_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "watch_reward_grants"   ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "watch_reward_progress", "watch_reward_grants" FROM anon, authenticated;

COMMIT;
