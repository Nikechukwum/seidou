import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  lt,
  or,
} from "drizzle-orm";

import { db } from "@/social/db";
import { getMux } from "@/social/lib/mux";
import {
  socialUserColumns,
  subscriptions,
  users,
  videoReactions,
  videos,
  videoUpdateSchema,
  videoViews,
} from "@/social/db/schema";
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/social/trpc/init";
import { APP_URL } from "@/social/constants";

/**
 * Videos: the feeds, the watch page, and the studio's write operations.
 *
 * Every `user:` projection selects socialUserColumns rather than the whole
 * users row. public.users is shared with the commerce app, so spreading it
 * would ship email, phone, dob and cash_balance to every browser loading the
 * feed.
 *
 * Pagination is keyset, not offset: ordering by (updatedAt DESC, id DESC) and
 * asking for "strictly older than the last row I saw". Stays correct when rows
 * are inserted mid-scroll, which OFFSET does not.
 *
 * Every mutation scopes its WHERE by ctx.user.id, so a video you do not own
 * simply matches nothing rather than being modified.
 */
/**
 * Re-reads an asset from Mux and writes back the columns the webhook would
 * have set. Shared by the manual "Refresh" button and the studio's poll, so
 * there is one definition of what "in sync with Mux" means.
 *
 * Scoped by userId: someone else's video simply does not match.
 */
const syncVideoWithMux = async (videoId: string, userId: string) => {
  const [existingVideo] = await db
    .select()
    .from(videos)
    .where(and(eq(videos.id, videoId), eq(videos.userId, userId)));

  if (!existingVideo) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  if (!existingVideo.muxUploadId) {
    throw new TRPCError({ code: "BAD_REQUEST" });
  }

  const upload = await getMux().video.uploads.retrieve(existingVideo.muxUploadId);

  // No asset yet means Mux has not finished ingesting; leave the row alone.
  if (!upload?.asset_id) {
    return existingVideo;
  }

  const asset = await getMux().video.assets.retrieve(upload.asset_id);

  if (!asset) {
    return existingVideo;
  }

  const playbackId = asset.playback_ids?.[0].id;
  const duration = asset.duration ? Math.round(asset.duration * 1000) : 0;

  const [updatedVideo] = await db
    .update(videos)
    .set({
      muxStatus: asset.status,
      muxPlaybackId: playbackId,
      muxAssetId: asset.id,
      duration,
      // Only fill these when the user has not uploaded a custom thumbnail.
      ...(playbackId && !existingVideo.thumbnailKey
        ? {
            thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg`,
            previewUrl: `https://image.mux.com/${playbackId}/animated.gif`,
          }
        : {}),
    })
    .where(and(eq(videos.id, videoId), eq(videos.userId, userId)))
    .returning();

  return updatedVideo;
};

export const videosRouter = createTRPCRouter({
  /**
   * Starts an upload. Returns a one-time Mux URL that the browser PUTs the
   * file to directly — the video never passes through this server, so there
   * is no request size limit to worry about.
   *
   * The row is created immediately in "waiting" state so the studio has
   * something to show; the Mux webhook fills in the playback id later.
   */
  create: protectedProcedure.mutation(async ({ ctx }) => {
    const { id: userId } = ctx.user;

    const upload = await getMux().video.uploads.create({
      new_asset_settings: {
        passthrough: userId,
        playback_policy: ["public"],
        input: [
          {
            generated_subtitles: [{ language_code: "en", name: "English" }],
          },
        ],
      },
      // Upstream used "*". Scoped to this app's origin so an arbitrary site
      // cannot use a leaked upload URL from a browser.
      cors_origin: APP_URL,
    });

    const [video] = await db
      .insert(videos)
      .values({
        userId,
        title: "Untitled",
        muxStatus: "waiting",
        muxUploadId: upload.id,
      })
      .returning();

    return { video, url: upload.url };
  }),

  update: protectedProcedure
    .input(videoUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      if (!input.id) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const [updatedVideo] = await db
        .update(videos)
        .set({
          title: input.title,
          description: input.description,
          categoryId: input.categoryId,
          visibility: input.visibility,
          updatedAt: new Date(),
        })
        // userId in the WHERE is the ownership check: a video you do not own
        // matches nothing rather than being updated.
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)))
        .returning();

      if (!updatedVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return updatedVideo;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const [removedVideo] = await db
        .delete(videos)
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)))
        .returning();

      if (!removedVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return removedVideo;
    }),

  /**
   * Manual resync, kept as an escape hatch. Webhooks do fail — a deploy
   * mid-flight, a dropped request — and without this a video could sit
   * "waiting" forever with no fix short of editing the database by hand.
   */
  revalidate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return syncVideoWithMux(input.id, ctx.user.id);
    }),

  /**
   * Poll target for the studio while a video is still processing.
   *
   * Polling the database alone would never resolve: without a webhook nothing
   * writes muxStatus, so the row would read "waiting" forever. This asks Mux
   * and syncs, but only while there is something to wait for — once the row is
   * ready or errored it returns immediately and stops calling Mux at all.
   */
  getStatus: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const [existingVideo] = await db
        .select()
        .from(videos)
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)));

      if (!existingVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Terminal states: nothing left to ask Mux about.
      if (
        existingVideo.muxStatus === "ready" ||
        existingVideo.muxStatus === "errored"
      ) {
        return existingVideo;
      }

      try {
        return await syncVideoWithMux(input.id, userId);
      } catch {
        // Mux not reachable, or the asset does not exist yet. Report the row
        // as it stands rather than failing the poll — the next tick retries.
        return existingVideo;
      }
    }),

  /**
   * Records a custom thumbnail after the browser has uploaded it.
   *
   * The file itself went straight to Supabase Storage under a folder named
   * after the uploader, which the bucket policies enforce. This is where
   * ownership of the VIDEO is checked, so nobody can point someone else's
   * video at their own image.
   */
  updateThumbnail: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        thumbnailUrl: z.string().url(),
        thumbnailKey: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const [updatedVideo] = await db
        .update(videos)
        .set({
          thumbnailUrl: input.thumbnailUrl,
          thumbnailKey: input.thumbnailKey,
          updatedAt: new Date(),
        })
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)))
        .returning();

      if (!updatedVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return updatedVideo;
    }),

  /**
   * Reverts to the thumbnail Mux generated.
   *
   * Upstream re-fetched the image from Mux and re-uploaded it. Since we
   * reference Mux URLs directly, this is just clearing the override — the
   * stored object is deleted by the caller, which holds the user session the
   * storage policies require.
   */
  restoreThumbnail: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const [existingVideo] = await db
        .select()
        .from(videos)
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)));

      if (!existingVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (!existingVideo.muxPlaybackId) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const [updatedVideo] = await db
        .update(videos)
        .set({
          thumbnailUrl: `https://image.mux.com/${existingVideo.muxPlaybackId}/thumbnail.jpg`,
          previewUrl: `https://image.mux.com/${existingVideo.muxPlaybackId}/animated.gif`,
          thumbnailKey: null,
          updatedAt: new Date(),
        })
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)))
        .returning();

      return updatedVideo;
    }),

  getOne: baseProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { authUserId } = ctx;

      // A base procedure, so the viewer is optional. inArray with an empty
      // array is the null-safe trick the upstream code uses: it yields a
      // condition that matches nothing rather than blowing up on undefined.
      const [viewer] = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, authUserId ? [authUserId] : []));

      const viewerId = viewer?.id;

      const viewerReactions = db.$with("viewer_reactions").as(
        db
          .select({
            videoId: videoReactions.videoId,
            type: videoReactions.type,
          })
          .from(videoReactions)
          .where(inArray(videoReactions.userId, viewerId ? [viewerId] : []))
      );

      const viewerSubscriptions = db.$with("viewer_subscriptions").as(
        db
          .select()
          .from(subscriptions)
          .where(inArray(subscriptions.viewerId, viewerId ? [viewerId] : []))
      );

      const [existingVideo] = await db
        .with(viewerReactions, viewerSubscriptions)
        .select({
          ...getTableColumns(videos),
          user: {
            ...socialUserColumns,
            subscriberCount: db.$count(
              subscriptions,
              eq(subscriptions.creatorId, users.id)
            ),
            viewerSubscribed: isNotNull(viewerSubscriptions.viewerId).mapWith(
              Boolean
            ),
          },
          viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)),
          likeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "like")
            )
          ),
          dislikeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "dislike")
            )
          ),
          viewerReaction: viewerReactions.type,
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .leftJoin(viewerReactions, eq(viewerReactions.videoId, videos.id))
        .leftJoin(
          viewerSubscriptions,
          eq(viewerSubscriptions.creatorId, users.id)
        )
        .where(eq(videos.id, input.id));

      if (!existingVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return existingVideo;
    }),

  getMany: baseProcedure
    .input(
      z.object({
        categoryId: z.string().uuid().nullish(),
        userId: z.string().uuid().nullish(),
        cursor: z
          .object({
            id: z.string().uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input }) => {
      const { cursor, limit, categoryId, userId } = input;

      const data = await db
        .select({
          ...getTableColumns(videos),
          user: socialUserColumns,
          viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)),
          likeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "like")
            )
          ),
          dislikeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "dislike")
            )
          ),
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .where(
          and(
            eq(videos.visibility, "public"),
            userId ? eq(videos.userId, userId) : undefined,
            categoryId ? eq(videos.categoryId, categoryId) : undefined,
            cursor
              ? or(
                  lt(videos.updatedAt, cursor.updatedAt),
                  and(
                    eq(videos.updatedAt, cursor.updatedAt),
                    lt(videos.id, cursor.id)
                  )
                )
              : undefined
          )
        )
        .orderBy(desc(videos.updatedAt), desc(videos.id))
        // One extra row tells us whether another page exists.
        .limit(limit + 1);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? { id: lastItem.id, updatedAt: lastItem.updatedAt }
        : null;

      return { items, nextCursor };
    }),

  getManyTrending: baseProcedure
    .input(
      z.object({
        cursor: z
          .object({
            id: z.string().uuid(),
            viewCount: z.number(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input }) => {
      const { cursor, limit } = input;

      // Ordering by a correlated count, so the same subquery is reused for the
      // select, the cursor comparison and the ordering.
      const viewCountSubquery = db.$count(
        videoViews,
        eq(videoViews.videoId, videos.id)
      );

      const data = await db
        .select({
          ...getTableColumns(videos),
          user: socialUserColumns,
          viewCount: viewCountSubquery,
          likeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "like")
            )
          ),
          dislikeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "dislike")
            )
          ),
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .where(
          and(
            eq(videos.visibility, "public"),
            cursor
              ? or(
                  lt(viewCountSubquery, cursor.viewCount),
                  and(
                    eq(viewCountSubquery, cursor.viewCount),
                    lt(videos.id, cursor.id)
                  )
                )
              : undefined
          )
        )
        .orderBy(desc(viewCountSubquery), desc(videos.id))
        .limit(limit + 1);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? { id: lastItem.id, viewCount: lastItem.viewCount }
        : null;

      return { items, nextCursor };
    }),

  getManySubscribed: protectedProcedure
    .input(
      z.object({
        cursor: z
          .object({
            id: z.string().uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const { id: userId } = ctx.user;
      const { cursor, limit } = input;

      const viewerSubscriptions = db.$with("viewer_subscriptions").as(
        db
          .select({ userId: subscriptions.creatorId })
          .from(subscriptions)
          .where(eq(subscriptions.viewerId, userId))
      );

      const data = await db
        .with(viewerSubscriptions)
        .select({
          ...getTableColumns(videos),
          user: socialUserColumns,
          viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)),
          likeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "like")
            )
          ),
          dislikeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "dislike")
            )
          ),
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .innerJoin(viewerSubscriptions, eq(viewerSubscriptions.userId, users.id))
        .where(
          and(
            eq(videos.visibility, "public"),
            cursor
              ? or(
                  lt(videos.updatedAt, cursor.updatedAt),
                  and(
                    eq(videos.updatedAt, cursor.updatedAt),
                    lt(videos.id, cursor.id)
                  )
                )
              : undefined
          )
        )
        .orderBy(desc(videos.updatedAt), desc(videos.id))
        .limit(limit + 1);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? { id: lastItem.id, updatedAt: lastItem.updatedAt }
        : null;

      return { items, nextCursor };
    }),
});
