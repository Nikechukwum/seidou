import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/social/db";
import {
  socialUserColumns,
  subscriptions,
  users,
  videos,
} from "@/social/db/schema";
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/social/trpc/init";

export const usersRouter = createTRPCRouter({
  /** Records a channel banner after the browser has uploaded it. */
  updateBanner: protectedProcedure
    .input(
      z.object({
        bannerUrl: z.string().url(),
        bannerKey: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updatedUser] = await db
        .update(users)
        .set({
          bannerUrl: input.bannerUrl,
          bannerKey: input.bannerKey,
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.user.id))
        .returning(socialUserColumns);

      return updatedUser;
    }),

  removeBanner: protectedProcedure.mutation(async ({ ctx }) => {
    const [updatedUser] = await db
      .update(users)
      .set({ bannerUrl: null, bannerKey: null, updatedAt: new Date() })
      .where(eq(users.id, ctx.user.id))
      .returning(socialUserColumns);

    return updatedUser;
  }),

  getOne: baseProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { authUserId } = ctx;

      // Base procedure, so the viewer is optional.
      const [viewer] = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, authUserId ? [authUserId] : []));

      const viewerId = viewer?.id;

      const viewerSubscriptions = db.$with("viewer_subscriptions").as(
        db
          .select()
          .from(subscriptions)
          .where(inArray(subscriptions.viewerId, viewerId ? [viewerId] : []))
      );

      const [existingUser] = await db
        .with(viewerSubscriptions)
        .select({
          ...socialUserColumns,
          viewerSubscribed: isNotNull(viewerSubscriptions.viewerId).mapWith(
            Boolean
          ),
          // Counts every video, including private ones, matching upstream.
          videoCount: db.$count(videos, eq(videos.userId, users.id)),
          subscriberCount: db.$count(
            subscriptions,
            eq(subscriptions.creatorId, users.id)
          ),
        })
        .from(users)
        .leftJoin(
          viewerSubscriptions,
          eq(viewerSubscriptions.creatorId, users.id)
        )
        .where(eq(users.id, input.id));

      if (!existingUser) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return existingUser;
    }),
});
