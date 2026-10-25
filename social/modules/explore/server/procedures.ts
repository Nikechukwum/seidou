import { z } from "zod";
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  lt,
  max,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/social/db";
import {
  categories,
  socialUserColumns,
  users,
  videoReactions,
  videos,
} from "@/social/db/schema";
import { baseProcedure, createTRPCRouter } from "@/social/trpc/init";
import { videoViewCount } from "@/social/modules/videos/server/view-count";

import { findSocialCategory, toCategorySlug } from "../constants";

/**
 * Explore grid and the per-category feed (/category/[slug]).
 *
 * Built to page through thousands of videos per category: keyset pagination
 * on (created_at DESC, id DESC), served by the partial indexes in
 * migrations/0004_catalogue.sql. Each request reads one page plus one row,
 * however deep the scroll — unlike OFFSET, which rereads everything before it.
 *
 * Imported videos and uploads share the videos table, so both appear here.
 */
export const exploreRouter = createTRPCRouter({
  /**
   * Resolves a URL slug to its category row. Returns a null id rather than
   * throwing when the category exists in the Explore grid but has not been
   * seeded yet, so the page shows "no videos" instead of a 404.
   */
  getCategory: baseProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const known = findSocialCategory(input.slug);

      if (known) {
        const [row] = await db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(sql`lower(${categories.name}) = lower(${known.name})`)
          .limit(1);

        return { slug: known.slug, name: known.name, id: row?.id ?? null };
      }

      // Not in the grid (e.g. a legacy category): match on the slugified name.
      // The table holds a few dozen rows, so reading it whole is fine.
      const rows = await db
        .select({ id: categories.id, name: categories.name })
        .from(categories);
      const row = rows.find((r) => toCategorySlug(r.name) === input.slug);

      return row ? { slug: input.slug, name: row.name, id: row.id } : null;
    }),

  /**
   * Same item shape as videos.getMany, so the existing feed cards render it
   * unchanged.
   */
  getVideos: baseProcedure
    .input(
      z.object({
        categoryId: z.string().uuid(),
        kind: z.enum(["video", "short"]).nullish(),
        cursor: z
          .object({
            id: z.string().uuid(),
            createdAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(50),
      })
    )
    .query(async ({ input }) => {
      const { categoryId, kind, cursor, limit } = input;

      const data = await db
        .select({
          ...getTableColumns(videos),
          user: socialUserColumns,
          viewCount: videoViewCount(),
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
            eq(videos.categoryId, categoryId),
            kind ? eq(videos.kind, kind) : undefined,
            cursor
              ? or(
                  lt(videos.createdAt, cursor.createdAt),
                  and(
                    eq(videos.createdAt, cursor.createdAt),
                    lt(videos.id, cursor.id)
                  )
                )
              : undefined
          )
        )
        .orderBy(desc(videos.createdAt), desc(videos.id))
        // One extra row tells us whether another page exists.
        .limit(limit + 1);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? { id: lastItem.id, createdAt: lastItem.createdAt }
        : null;

      return { items, nextCursor };
    }),

  /**
   * Channels with public videos in the category, most recently active first.
   * Keyset on the aggregate (latest upload, user id), hence HAVING not WHERE.
   */
  getChannels: baseProcedure
    .input(
      z.object({
        categoryId: z.string().uuid(),
        cursor: z
          .object({
            id: z.string().uuid(),
            latestAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(50),
      })
    )
    .query(async ({ input }) => {
      const { categoryId, cursor, limit } = input;

      const latestAt = max(videos.createdAt);

      const data = await db
        .select({
          ...socialUserColumns,
          videoCount: count(videos.id),
          latestAt,
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .where(
          and(
            eq(videos.visibility, "public"),
            eq(videos.categoryId, categoryId)
          )
        )
        .groupBy(users.id)
        .having(
          cursor
            ? or(
                lt(latestAt, cursor.latestAt),
                and(eq(latestAt, cursor.latestAt), lt(users.id, cursor.id))
              )
            : undefined
        )
        .orderBy(desc(latestAt), desc(users.id))
        .limit(limit + 1);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor =
        hasMore && lastItem.latestAt
          ? { id: lastItem.id, latestAt: lastItem.latestAt }
          : null;

      return { items, nextCursor };
    }),
});
