import { eq, sql } from "drizzle-orm";

import { db } from "@/social/db";
import { videos, videoViews } from "@/social/db/schema";

/**
 * A video's view count: our own recorded views only.
 *
 * Imported videos arrive with the source's reported count in
 * `imported_view_count`, but that is deliberately not added here — product
 * wants views to be organic, earned by people watching in Seidou. The column
 * stays for provenance; it is never displayed.
 *
 * The one definition every feed selects, so an uploaded video shows the same
 * count on the home feed, the category page, search and the watch page. Usable
 * in WHERE and ORDER BY too — trending pages on it.
 */
export const videoViewCount = () =>
  db
    .$count(videoViews, eq(videoViews.videoId, videos.id))
    .mapWith(Number);

/**
 * videos.updated_at truncated to milliseconds — what every feed that pages on
 * updated_at must order and compare by.
 *
 * The column holds microseconds (a trigger sets it to now() on every UPDATE),
 * but the cursor round-trips through a JS Date, which keeps milliseconds. Rows
 * updated within the same millisecond as the cursor row — any bulk UPDATE — then
 * compared as newer than their own cursor and were skipped on the next page.
 */
export const videoUpdatedAtMs = () =>
  sql<Date>`date_trunc('milliseconds', ${videos.updatedAt})`;

/**
 * A cursor Date as a SQL timestamp, for comparing against videoUpdatedAtMs().
 *
 * Needed because comparing to a raw SQL expression skips drizzle's column
 * mapping: the bare Date reached the postgres driver, which cannot serialize
 * it, and every page after the first failed. The column is `timestamp`
 * without time zone holding UTC, and the ISO string's offset is ignored by
 * the cast — the same value drizzle itself would send.
 */
export const asTimestamp = (date: Date) =>
  sql`${date.toISOString()}::timestamp`;
