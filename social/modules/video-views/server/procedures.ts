import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/social/db";
import { videoViews } from "@/social/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/social/trpc/init";

/**
 * Views are keyed on (user_id, video_id), so the count stays unique per
 * viewer rather than counting replays. Signed-out views are not tracked at
 * all — see the deferred list in docs/seidou-social.md.
 *
 * A repeat watch touches updated_at without adding a row: the view count is
 * unchanged, but watch history orders on updated_at, so rewatching an old
 * video floats it back to the top where you would expect to find it.
 */
export const videoViewsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { videoId } = input;
      const { id: userId } = ctx.user;

      // One statement rather than select-then-insert: the composite primary
      // key makes the conflict the natural path for a rewatch, and it avoids
      // a race where two plays both see "no row" and one insert fails.
      const [videoView] = await db
        .insert(videoViews)
        .values({ userId, videoId })
        .onConflictDoUpdate({
          target: [videoViews.userId, videoViews.videoId],
          set: { updatedAt: new Date() },
        })
        .returning();

      return videoView;
    }),
});
