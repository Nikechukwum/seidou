import { eq, sql } from "drizzle-orm";

import { db } from "@/social/db";
import { videos, videoViews } from "@/social/db/schema";

/**
 * A video's view count: our own recorded views plus whatever the source
 * reported when it was imported (zero for uploaded videos).
 *
 * The one definition every feed selects, so an imported video shows the same
 * count on the home feed, the category page, search and the watch page. Usable
 * in WHERE and ORDER BY too — trending pages on it.
 */
export const videoViewCount = () =>
  sql<number>`(${db.$count(videoViews, eq(videoViews.videoId, videos.id))} + ${videos.importedViewCount})`.mapWith(
    Number
  );
