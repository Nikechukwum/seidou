import { z } from "zod";
import { desc } from "drizzle-orm";

import { db } from "@/social/db";
import { youtubeVideos } from "@/social/db/schema";
import { adminProcedure, createTRPCRouter } from "@/social/trpc/init";

import {
  IMPORT_BATCH_SIZE,
  youtubeImportRowSchema,
  type YoutubeImportRow,
} from "../lib/parse";

/** How many rows the import page lists under "Last imported". */
const RECENT_LIMIT = 10;

/**
 * The YouTube library: videos hosted on YouTube, brought in by the import
 * page. Admin-only for now — the import page is the only screen that reads or
 * writes them.
 */
export const youtubeVideosRouter = createTRPCRouter({
  /** The most recently imported videos, newest first. */
  getRecent: adminProcedure.query(async () => {
    return db
      .select()
      .from(youtubeVideos)
      .orderBy(desc(youtubeVideos.createdAt), desc(youtubeVideos.id))
      .limit(RECENT_LIMIT);
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

      const insertedRows = await db
        .insert(youtubeVideos)
        .values(valid)
        .onConflictDoNothing({ target: youtubeVideos.youtubeId })
        .returning({ youtubeId: youtubeVideos.youtubeId });

      return {
        inserted: insertedRows.length,
        skipped: valid.length - insertedRows.length,
        failed,
      };
    }),
});
