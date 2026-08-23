import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/social/db";
import { videoViews } from "@/social/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/social/trpc/init";

/**
 * Views are keyed on (user_id, video_id), so they are unique per viewer
 * rather than counting replays. Signed-out views are not tracked at all —
 * see the deferred list in docs/seidou-social.md.
 */
export const videoViewsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { videoId } = input;
      const { id: userId } = ctx.user;

      const [existingVideoView] = await db
        .select()
        .from(videoViews)
        .where(
          and(eq(videoViews.videoId, videoId), eq(videoViews.userId, userId))
        );

      if (existingVideoView) {
        return existingVideoView;
      }

      const [createdVideoView] = await db
        .insert(videoViews)
        .values({ userId, videoId })
        .returning();

      return createdVideoView;
    }),
});
