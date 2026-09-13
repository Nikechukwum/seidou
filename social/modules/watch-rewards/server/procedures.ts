import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { db } from "@/social/db";
import {
  users,
  videos,
  watchRewardGrants,
  watchRewardProgress,
} from "@/social/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/social/trpc/init";
import type { LoyaltyReward } from "@/lib/loyalty-rewards";

import { computeAccrual } from "./accrual";
import { getWatchRewardConfig } from "./config";

/**
 * Watch-time loyalty rewards.
 *
 * The player calls `heartbeat` every 15s while a video is playing in a
 * visible tab, and once with event "stop" when playback pauses or the tab is
 * hidden. The browser sends no times: all elapsed time is measured with
 * Postgres now(), and there is one clock per user, so extra tabs or faster
 * playback earn nothing extra.
 *
 * Rewards are appended to users.loyalty_rewards with source "video" and
 * claimed through claim_loyalty_reward, which decides the amount server-side.
 */
export const watchRewardsRouter = createTRPCRouter({
  heartbeat: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        event: z.enum(["beat", "stop"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { videoId, event } = input;
      const { id: userId } = ctx.user;
      const cfg = getWatchRewardConfig();

      // Only someone else's public, playable video counts.
      const [video] = await db
        .select({
          userId: videos.userId,
          visibility: videos.visibility,
          muxStatus: videos.muxStatus,
        })
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);

      if (!video) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (
        video.visibility !== "public" ||
        video.muxStatus !== "ready" ||
        video.userId === userId
      ) {
        if (process.env.NODE_ENV === "development") {
          console.log(
            `[watch-rewards] ${event} rejected: ${video.userId === userId ? "own video" : `visibility ${video.visibility}, status ${video.muxStatus}`}`
          );
        }
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return db.transaction(async (tx) => {
        await tx
          .insert(watchRewardProgress)
          .values({ userId })
          .onConflictDoNothing();

        // The row lock serializes every heartbeat for this user, which is
        // what makes the cap check and the grant below safe under
        // concurrent requests from several tabs.
        const [row] = await tx
          .select({
            progressMs: watchRewardProgress.progressMs,
            windowGrants: watchRewardProgress.windowGrants,
            gapMs: sql<number | null>`floor(extract(epoch from (now() - ${watchRewardProgress.lastHeartbeatAt})) * 1000)::float8`,
            windowAgeMs: sql<number | null>`floor(extract(epoch from (now() - ${watchRewardProgress.windowStartedAt})) * 1000)::float8`,
            nowMs: sql<number>`floor(extract(epoch from now()) * 1000)::float8`,
          })
          .from(watchRewardProgress)
          .where(eq(watchRewardProgress.userId, userId))
          .for("update");

        if (!row) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        const result = computeAccrual(
          {
            progressMs: row.progressMs,
            gapMs: row.gapMs === null ? null : Number(row.gapMs),
            windowGrants: row.windowGrants,
            windowAgeMs: row.windowAgeMs === null ? null : Number(row.windowAgeMs),
          },
          cfg
        );

        // A stop, or reaching the cap, stops the clock so the next beat
        // starts fresh instead of crediting the time in between.
        const stopClock = event === "stop" || result.capReached;

        await tx
          .update(watchRewardProgress)
          .set({
            progressMs: result.progressMs,
            windowGrants: result.windowGrants,
            // undefined leaves the column untouched
            windowStartedAt:
              result.windowAction === "open"
                ? sql`now()`
                : result.windowAction === "clear"
                  ? null
                  : undefined,
            // GREATEST keeps the clock from moving backwards when this
            // transaction started before the one that last set it.
            lastHeartbeatAt: stopClock
              ? null
              : sql`greatest(coalesce(${watchRewardProgress.lastHeartbeatAt}, now()), now())`,
            lastVideoId: videoId,
            updatedAt: sql`now()`,
          })
          .where(eq(watchRewardProgress.userId, userId));

        // Dev-only trace for testing; silent in production builds.
        if (process.env.NODE_ENV === "development") {
          console.log(
            `[watch-rewards] ${event}  +${(result.creditedMs / 1000).toFixed(1)}s  progress ${(result.progressMs / 1000).toFixed(1)}s / ${cfg.msPerReward / 1000}s  window ${result.windowGrants}/${cfg.cap}` +
              (result.newGrants ? `  GRANTED ${result.newGrants}` : "") +
              (result.capReached ? "  CAP REACHED" : "")
          );
        }

        let loyaltyRewards: LoyaltyReward[] | null = null;

        if (result.newGrants > 0) {
          const nowMs = Number(row.nowMs);
          const rewards: LoyaltyReward[] = Array.from(
            { length: result.newGrants },
            (_, i) => ({
              id: nowMs + i,
              amount: String(cfg.amount),
              source: "video",
            })
          );

          await tx.insert(watchRewardGrants).values(
            rewards.map((reward) => ({
              userId,
              rewardId: reward.id,
              amount: cfg.amount,
              videoId,
            }))
          );

          // Appended in SQL rather than read-modify-write, so a claim or
          // another grant landing at the same time is never overwritten.
          //
          // loyalty_rewards is a Postgres jsonb[] (an array of jsonb values),
          // not one jsonb document, so this is array concatenation. It is
          // read back as JSON text and parsed here rather than relying on the
          // driver to map a jsonb[].
          const [updated] = await tx
            .update(users)
            .set({
              loyaltyRewards: sql`coalesce(${users.loyaltyRewards}, '{}'::jsonb[]) || array(select jsonb_array_elements(${JSON.stringify(rewards)}::jsonb))`,
            })
            .where(eq(users.id, userId))
            .returning({
              loyaltyRewardsJson: sql<string>`to_jsonb(${users.loyaltyRewards})::text`,
            });

          loyaltyRewards = updated
            ? (JSON.parse(updated.loyaltyRewardsJson) as LoyaltyReward[])
            : null;
        }

        return {
          creditedMs: result.creditedMs,
          progressMs: result.progressMs,
          msPerReward: cfg.msPerReward,
          windowGrants: result.windowGrants,
          cap: cfg.cap,
          capReached: result.capReached,
          capFreesInMs: result.capFreesInMs,
          granted: result.newGrants,
          loyaltyRewards,
        };
      });
    }),
});
