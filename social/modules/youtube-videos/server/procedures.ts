import { z } from "zod";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { db } from "@/social/db";
import { youtubeChannels, youtubeVideos } from "@/social/db/schema";
import { adminProcedure, baseProcedure, createTRPCRouter } from "@/social/trpc/init";

import {
  IMPORT_BATCH_SIZE,
  youtubeChannelInputSchema,
  youtubeImportRowSchema,
  type YoutubeImportRow,
} from "../lib/parse";

/**
 * Channel images must be objects the import page uploaded to OUR bucket,
 * under youtube-channels/ — never an arbitrary URL that would be rendered
 * later as if it were ours.
 */
const CHANNEL_IMAGE_PREFIX = "youtube-channels/";
const isOurChannelImage = (image: { url: string; key: string } | null) => {
  if (!image) return true;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base || !image.key.startsWith(CHANNEL_IMAGE_PREFIX) || image.key.includes("..")) return false;
  const expected = `${base}/storage/v1/object/public/social/${image.key}`;
  return image.url === expected || image.url.startsWith(`${expected}?`);
};

/** How many rows the import page lists under "Last imported". */
const RECENT_LIMIT = 10;

/**
 * The YouTube library: videos hosted on YouTube, brought in by the import
 * page. Admin-only for now — the import page is the only screen that reads or
 * writes them.
 */
/** What the watch page and its "more videos" list read for a YouTube video. */
const watchColumns = {
  id: youtubeVideos.id,
  youtubeId: youtubeVideos.youtubeId,
  title: youtubeVideos.title,
  category: youtubeVideos.category,
  channelName: sql<string | null>`coalesce(${youtubeChannels.name}, ${youtubeVideos.actualChannelName}, ${youtubeVideos.channelName})`,
  channelAvatarUrl: youtubeChannels.avatarUrl,
  channelHandle: youtubeChannels.handle,
  createdAt: youtubeVideos.createdAt,
};

/** How many oEmbed requests run at once — polite to YouTube, still quick. */
const LOOKUP_CONCURRENCY = 6;

/**
 * YouTube's own title and channel for one video, from its public oEmbed
 * endpoint (no API key). Null when YouTube does not answer — the import then
 * keeps the title read from the saved page.
 */
const lookupVideo = async (youtubeId: string) => {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${youtubeId}`)}&format=json`,
      { signal: AbortSignal.timeout(8000), cache: "no-store" }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { title?: unknown; author_name?: unknown };
    return {
      title: typeof data.title === "string" ? data.title : null,
      author: typeof data.author_name === "string" ? data.author_name : null,
    };
  } catch {
    return null;
  }
};

export const youtubeVideosRouter = createTRPCRouter({
  /**
   * Step 1 of /import: YouTube's title and channel name for up to 50 videos
   * read from a saved page. Run on the server because YouTube's oEmbed
   * endpoint cannot be called from the browser (no CORS).
   */
  lookup: adminProcedure
    .input(z.object({ youtubeIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{11}$/)).min(1).max(50) }))
    .mutation(async ({ input }) => {
      const results: Record<string, { title: string | null; author: string | null } | null> = {};
      const queue = [...new Set(input.youtubeIds)];
      await Promise.all(
        Array.from({ length: Math.min(LOOKUP_CONCURRENCY, queue.length) }, async () => {
          for (let id = queue.shift(); id; id = queue.shift()) {
            results[id] = await lookupVideo(id);
          }
        })
      );
      return results;
    }),

  /**
   * One imported video for its watch page, with its channel. Public, like
   * videos.getOne — imported videos appear in the public feed.
   */
  getOne: baseProcedure
    .input(z.object({ youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/) }))
    .query(async ({ input }) => {
      const [video] = await db
        .select({
          ...watchColumns,
          channel: {
            id: youtubeChannels.id,
            handle: youtubeChannels.handle,
            name: youtubeChannels.name,
            subscribersText: youtubeChannels.subscribersText,
            avatarUrl: youtubeChannels.avatarUrl,
            bannerUrl: youtubeChannels.bannerUrl,
          },
        })
        .from(youtubeVideos)
        .leftJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
        .where(eq(youtubeVideos.youtubeId, input.youtubeId))
        .limit(1);

      if (!video) throw new TRPCError({ code: "NOT_FOUND" });
      // leftJoin fills every channel field with null when there is no channel.
      return { ...video, channel: video.channel?.id ? video.channel : null };
    }),

  /**
   * A YouTube channel's page: its details and its imported videos, newest
   * first. `handle` comes from the URL without the "@".
   */
  getChannel: baseProcedure
    .input(z.object({ handle: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const handle = `@${input.handle.replace(/^@/, "").toLowerCase()}`;

      const [channel] = await db
        .select()
        .from(youtubeChannels)
        .where(eq(youtubeChannels.handle, handle))
        .limit(1);

      if (!channel) throw new TRPCError({ code: "NOT_FOUND" });

      const videos = await db
        .select(watchColumns)
        .from(youtubeVideos)
        .leftJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
        .where(eq(youtubeVideos.channelId, channel.id))
        .orderBy(desc(youtubeVideos.createdAt), desc(youtubeVideos.id))
        .limit(200);

      return { channel, videos };
    }),

  /**
   * "More videos" under the player: the rest of the same channel, or — for a
   * video imported without a channel — the latest imports.
   */
  getMore: baseProcedure
    .input(
      z.object({
        youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const [current] = await db
        .select({ channelId: youtubeVideos.channelId })
        .from(youtubeVideos)
        .where(eq(youtubeVideos.youtubeId, input.youtubeId))
        .limit(1);

      return db
        .select(watchColumns)
        .from(youtubeVideos)
        .leftJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
        .where(
          and(
            ne(youtubeVideos.youtubeId, input.youtubeId),
            current?.channelId ? eq(youtubeVideos.channelId, current.channelId) : undefined
          )
        )
        .orderBy(desc(youtubeVideos.createdAt), desc(youtubeVideos.id))
        .limit(input.limit);
    }),

  /** The most recently imported videos, newest first. */
  getRecent: adminProcedure.query(async () => {
    return db
      .select()
      .from(youtubeVideos)
      .orderBy(desc(youtubeVideos.createdAt), desc(youtubeVideos.id))
      .limit(RECENT_LIMIT);
  }),

  /**
   * Creates or updates one channel. Called by the import page for each channel
   * in the file, after it has uploaded the channel's images, and before the
   * videos — so their channelHandle has a row to point at.
   *
   * A re-import overwrites the details. An image is only replaced when a new
   * one came with the import; otherwise the stored one is kept.
   */
  upsertChannel: adminProcedure
    .input(youtubeChannelInputSchema)
    .mutation(async ({ input }) => {
      if (!isOurChannelImage(input.avatar) || !isOurChannelImage(input.banner)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Channel images must be uploaded by the import page." });
      }

      const [row] = await db
        .insert(youtubeChannels)
        .values({
          handle: input.handle,
          name: input.name,
          subscribersText: input.subscribersText,
          videoCountText: input.videoCountText,
          sourceUrl: input.sourceUrl,
          avatarUrl: input.avatar?.url ?? null,
          avatarKey: input.avatar?.key ?? null,
          bannerUrl: input.banner?.url ?? null,
          bannerKey: input.banner?.key ?? null,
        })
        .onConflictDoUpdate({
          target: youtubeChannels.handle,
          set: {
            name: input.name,
            subscribersText: input.subscribersText,
            videoCountText: input.videoCountText,
            sourceUrl: sql`coalesce(excluded.source_url, ${youtubeChannels.sourceUrl})`,
            avatarUrl: sql`coalesce(excluded.avatar_url, ${youtubeChannels.avatarUrl})`,
            avatarKey: sql`coalesce(excluded.avatar_key, ${youtubeChannels.avatarKey})`,
            bannerUrl: sql`coalesce(excluded.banner_url, ${youtubeChannels.bannerUrl})`,
            bannerKey: sql`coalesce(excluded.banner_key, ${youtubeChannels.bannerKey})`,
            updatedAt: sql`now()`,
          },
        })
        .returning({ id: youtubeChannels.id, handle: youtubeChannels.handle });

      return row;
    }),

  /**
   * Writes one batch of an import.
   *
   * Rows arrive as `unknown` and are validated one at a time rather than as
   * part of the input schema: a single bad row should be reported back with
   * its position, not reject the 199 good ones alongside it.
   *
   * The insert is a single statement, so a batch lands whole or not at all.
   * ON CONFLICT DO NOTHING on youtube_id is what makes the import idempotent:
   * a video already in the table is left exactly as it is and counted as
   * skipped, so overlapping exports and retried batches are both safe.
   */
  importBatch: adminProcedure
    .input(
      z.object({
        rows: z.array(z.unknown()).min(1).max(IMPORT_BATCH_SIZE),
      })
    )
    .mutation(async ({ input }) => {
      const valid: YoutubeImportRow[] = [];
      const failed: { index: number; reason: string }[] = [];

      input.rows.forEach((raw, index) => {
        const parsed = youtubeImportRowSchema.safeParse(raw);

        if (parsed.success) {
          valid.push(parsed.data);
          return;
        }

        const issue = parsed.error.issues[0];
        failed.push({
          index,
          reason: `${issue.path.join(".") || "row"}: ${issue.message}`,
        });
      });

      if (valid.length === 0) {
        return { inserted: 0, skipped: 0, failed };
      }

      // Resolve each row's channelHandle to the channel row upsertChannel
      // wrote. A handle with no row (its channel failed to save) leaves the
      // video unlinked; a later import of that channel links it.
      const handles = [...new Set(valid.flatMap((row) => row.channelHandle ?? []))];
      const channelIds = new Map<string, string>();
      if (handles.length > 0) {
        const channels = await db
          .select({ id: youtubeChannels.id, handle: youtubeChannels.handle })
          .from(youtubeChannels)
          .where(inArray(youtubeChannels.handle, handles));
        channels.forEach((c) => channelIds.set(c.handle, c.id));
      }
      const channelIdOf = (row: YoutubeImportRow) =>
        (row.channelHandle && channelIds.get(row.channelHandle)) || null;

      const insertedRows = await db
        .insert(youtubeVideos)
        .values(valid.map((row) => {
          const { channelHandle: _handle, ...video } = row;
          return { ...video, channelId: channelIdOf(row) };
        }))
        .onConflictDoNothing({ target: youtubeVideos.youtubeId })
        .returning({ youtubeId: youtubeVideos.youtubeId });

      // Videos that were already here are left as they are — except that one
      // imported before its channel was known gets linked now.
      const inserted = new Set(insertedRows.map((r) => r.youtubeId));
      const toLink = new Map<string, string[]>();
      valid.forEach((row) => {
        const channelId = channelIdOf(row);
        if (!channelId || inserted.has(row.youtubeId)) return;
        toLink.set(channelId, [...(toLink.get(channelId) ?? []), row.youtubeId]);
      });
      for (const [channelId, youtubeIds] of toLink) {
        await db
          .update(youtubeVideos)
          .set({ channelId, updatedAt: sql`now()` })
          .where(and(inArray(youtubeVideos.youtubeId, youtubeIds), isNull(youtubeVideos.channelId)));
      }

      return {
        inserted: insertedRows.length,
        skipped: valid.length - insertedRows.length,
        failed,
      };
    }),
});
