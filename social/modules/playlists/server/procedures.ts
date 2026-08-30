import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, getTableColumns, lt, or, sql } from "drizzle-orm";

import { db } from "@/social/db";
import {
  playlists,
  playlistVideos,
  socialUserColumns,
  users,
  videoReactions,
  videos,
  videoViews,
} from "@/social/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/social/trpc/init";

/**
 * Playlists, plus the two "virtual" ones — liked videos and watch history.
 *
 * Those two own no rows of their own: they are CTEs over video_reactions and
 * video_views, which the watch page already populates. They paginate on when
 * you liked or watched something rather than when the video was last updated,
 * so the ordering matches what a viewer expects.
 *
 * Everything here is protected and scoped to ctx.user.id — playlists are
 * private to their owner.
 */

// Shared by every procedure that returns videos, so the shapes stay identical
// and the card components can consume any of them.
const videoCounts = {
  viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)),
  likeCount: db.$count(
    videoReactions,
    and(eq(videoReactions.videoId, videos.id), eq(videoReactions.type, "like"))
  ),
  dislikeCount: db.$count(
    videoReactions,
    and(
      eq(videoReactions.videoId, videos.id),
      eq(videoReactions.type, "dislike")
    )
  ),
};

export const playlistsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(120) }))
    .mutation(async ({ input, ctx }) => {
      const [createdPlaylist] = await db
        .insert(playlists)
        .values({ userId: ctx.user.id, name: input.name })
        .returning();

      if (!createdPlaylist) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      return createdPlaylist;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // userId in the WHERE is the ownership check.
      const [deletedPlaylist] = await db
        .delete(playlists)
        .where(
          and(eq(playlists.id, input.id), eq(playlists.userId, ctx.user.id))
        )
        .returning();

      if (!deletedPlaylist) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return deletedPlaylist;
    }),

  getOne: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const [existingPlaylist] = await db
        .select()
        .from(playlists)
        .where(
          and(eq(playlists.id, input.id), eq(playlists.userId, ctx.user.id))
        );

      if (!existingPlaylist) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return existingPlaylist;
    }),

  getMany: protectedProcedure
    .input(
      z.object({
        cursor: z
          .object({ id: z.string().uuid(), updatedAt: z.date() })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const { cursor, limit } = input;

      const data = await db
        .select({
          ...getTableColumns(playlists),
          user: socialUserColumns,
          videoCount: db.$count(
            playlistVideos,
            eq(playlists.id, playlistVideos.playlistId)
          ),
          // Cover image: the thumbnail of the most recently added video.
          thumbnailUrl: sql<string | null>`(
            SELECT v.thumbnail_url
            FROM ${playlistVideos} pv
            JOIN ${videos} v ON v.id = pv.video_id
            WHERE pv.playlist_id = ${playlists.id}
            ORDER BY pv.updated_at DESC
            LIMIT 1
          )`,
        })
        .from(playlists)
        .innerJoin(users, eq(playlists.userId, users.id))
        .where(
          and(
            eq(playlists.userId, ctx.user.id),
            cursor
              ? or(
                  lt(playlists.updatedAt, cursor.updatedAt),
                  and(
                    eq(playlists.updatedAt, cursor.updatedAt),
                    lt(playlists.id, cursor.id)
                  )
                )
              : undefined
          )
        )
        .orderBy(desc(playlists.updatedAt), desc(playlists.id))
        .limit(limit + 1);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? { id: lastItem.id, updatedAt: lastItem.updatedAt }
        : null;

      return { items, nextCursor };
    }),

  /**
   * Powers the "Add to playlist" sheet: your playlists, each already flagged
   * with whether it contains this video, so the sheet can render checkmarks
   * without a second round of queries.
   */
  getManyForVideo: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        cursor: z
          .object({ id: z.string().uuid(), updatedAt: z.date() })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const { cursor, limit, videoId } = input;

      const data = await db
        .select({
          ...getTableColumns(playlists),
          user: socialUserColumns,
          videoCount: db.$count(
            playlistVideos,
            eq(playlists.id, playlistVideos.playlistId)
          ),
          containsVideo: sql<boolean>`(
            SELECT EXISTS (
              SELECT 1
              FROM ${playlistVideos} pv
              WHERE pv.playlist_id = ${playlists.id} AND pv.video_id = ${videoId}
            )
          )`,
        })
        .from(playlists)
        .innerJoin(users, eq(playlists.userId, users.id))
        .where(
          and(
            eq(playlists.userId, ctx.user.id),
            cursor
              ? or(
                  lt(playlists.updatedAt, cursor.updatedAt),
                  and(
                    eq(playlists.updatedAt, cursor.updatedAt),
                    lt(playlists.id, cursor.id)
                  )
                )
              : undefined
          )
        )
        .orderBy(desc(playlists.updatedAt), desc(playlists.id))
        .limit(limit + 1);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? { id: lastItem.id, updatedAt: lastItem.updatedAt }
        : null;

      return { items, nextCursor };
    }),

  getVideos: protectedProcedure
    .input(
      z.object({
        playlistId: z.string().uuid(),
        cursor: z
          .object({ id: z.string().uuid(), updatedAt: z.date() })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const { cursor, limit, playlistId } = input;

      const [existingPlaylist] = await db
        .select()
        .from(playlists)
        .where(
          and(eq(playlists.id, playlistId), eq(playlists.userId, ctx.user.id))
        );

      if (!existingPlaylist) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const videosFromPlaylist = db.$with("videos_from_playlist").as(
        db
          .select({ videoId: playlistVideos.videoId })
          .from(playlistVideos)
          .where(eq(playlistVideos.playlistId, playlistId))
      );

      const data = await db
        .with(videosFromPlaylist)
        .select({
          ...getTableColumns(videos),
          user: socialUserColumns,
          ...videoCounts,
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .innerJoin(videosFromPlaylist, eq(videos.id, videosFromPlaylist.videoId))
        .where(
          and(
            // A video made private after being added disappears from the
            // playlist rather than leaking.
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

  addVideo: protectedProcedure
    .input(
      z.object({
        playlistId: z.string().uuid(),
        videoId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { playlistId, videoId } = input;

      const [existingPlaylist] = await db
        .select()
        .from(playlists)
        .where(
          and(eq(playlists.id, playlistId), eq(playlists.userId, ctx.user.id))
        );

      if (!existingPlaylist) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [existingVideo] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId));

      if (!existingVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [alreadyAdded] = await db
        .select()
        .from(playlistVideos)
        .where(
          and(
            eq(playlistVideos.playlistId, playlistId),
            eq(playlistVideos.videoId, videoId)
          )
        );

      if (alreadyAdded) {
        throw new TRPCError({ code: "CONFLICT" });
      }

      const [created] = await db
        .insert(playlistVideos)
        .values({ playlistId, videoId })
        .returning();

      return created;
    }),

  removeVideo: protectedProcedure
    .input(
      z.object({
        playlistId: z.string().uuid(),
        videoId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { playlistId, videoId } = input;

      const [existingPlaylist] = await db
        .select()
        .from(playlists)
        .where(
          and(eq(playlists.id, playlistId), eq(playlists.userId, ctx.user.id))
        );

      if (!existingPlaylist) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [deleted] = await db
        .delete(playlistVideos)
        .where(
          and(
            eq(playlistVideos.playlistId, playlistId),
            eq(playlistVideos.videoId, videoId)
          )
        )
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return deleted;
    }),

  /** Virtual playlist over video_reactions. Owns no rows of its own. */
  getLiked: protectedProcedure
    .input(
      z.object({
        cursor: z.object({ id: z.string().uuid(), likedAt: z.date() }).nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const { cursor, limit } = input;

      const viewerVideoReactions = db.$with("viewer_video_reactions").as(
        db
          .select({
            videoId: videoReactions.videoId,
            likedAt: videoReactions.updatedAt,
          })
          .from(videoReactions)
          .where(
            and(
              eq(videoReactions.userId, ctx.user.id),
              eq(videoReactions.type, "like")
            )
          )
      );

      const data = await db
        .with(viewerVideoReactions)
        .select({
          ...getTableColumns(videos),
          user: socialUserColumns,
          likedAt: viewerVideoReactions.likedAt,
          ...videoCounts,
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .innerJoin(
          viewerVideoReactions,
          eq(videos.id, viewerVideoReactions.videoId)
        )
        .where(
          and(
            eq(videos.visibility, "public"),
            // Ordered by when you liked it, not when the video changed.
            cursor
              ? or(
                  lt(viewerVideoReactions.likedAt, cursor.likedAt),
                  and(
                    eq(viewerVideoReactions.likedAt, cursor.likedAt),
                    lt(videos.id, cursor.id)
                  )
                )
              : undefined
          )
        )
        .orderBy(desc(viewerVideoReactions.likedAt), desc(videos.id))
        .limit(limit + 1);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? { id: lastItem.id, likedAt: lastItem.likedAt }
        : null;

      return { items, nextCursor };
    }),

  /** Virtual playlist over video_views. Owns no rows of its own. */
  getHistory: protectedProcedure
    .input(
      z.object({
        cursor: z
          .object({ id: z.string().uuid(), viewedAt: z.date() })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const { cursor, limit } = input;

      const viewerVideoViews = db.$with("viewer_video_views").as(
        db
          .select({
            videoId: videoViews.videoId,
            viewedAt: videoViews.updatedAt,
          })
          .from(videoViews)
          .where(eq(videoViews.userId, ctx.user.id))
      );

      const data = await db
        .with(viewerVideoViews)
        .select({
          ...getTableColumns(videos),
          user: socialUserColumns,
          viewedAt: viewerVideoViews.viewedAt,
          ...videoCounts,
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .innerJoin(viewerVideoViews, eq(videos.id, viewerVideoViews.videoId))
        .where(
          and(
            eq(videos.visibility, "public"),
            cursor
              ? or(
                  lt(viewerVideoViews.viewedAt, cursor.viewedAt),
                  and(
                    eq(viewerVideoViews.viewedAt, cursor.viewedAt),
                    lt(videos.id, cursor.id)
                  )
                )
              : undefined
          )
        )
        .orderBy(desc(viewerVideoViews.viewedAt), desc(videos.id))
        .limit(limit + 1);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? { id: lastItem.id, viewedAt: lastItem.viewedAt }
        : null;

      return { items, nextCursor };
    }),
});
