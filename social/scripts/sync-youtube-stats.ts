import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

/**
 * Fills in real durations and view counts for imported YouTube videos.
 *
 *   npm run social:sync-youtube-stats
 *
 * The import JSON carries neither, so imported rows start at duration 0 (no
 * badge on the thumbnail) and 0 views. This asks the YouTube Data API v3 for
 * each video's contentDetails + statistics, 50 ids per request — 1 quota unit
 * each, against a free daily allowance of 10,000.
 *
 * Safe to re-run after every import: rows whose numbers have not changed are
 * left untouched. Videos YouTube no longer serves (deleted, private) are
 * reported and left as they are.
 *
 * Needs YOUTUBE_API_KEY and DATABASE_URL in .env.local.
 */

const BATCH = 50;
const INT_MAX = 2_147_483_647; // imported_view_count is a Postgres integer

/** ISO 8601 duration ("PT1H2M3S", "P1DT2H") to milliseconds. */
const parseDuration = (iso: string): number => {
  const m = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const [, d = "0", h = "0", min = "0", s = "0"] = m;
  return (((+d * 24 + +h) * 60 + +min) * 60 + +s) * 1000;
};

interface YouTubeItem {
  id: string;
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string };
}

async function fetchBatch(ids: string[], key: string): Promise<YouTubeItem[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "contentDetails,statistics");
  url.searchParams.set("id", ids.join(","));
  url.searchParams.set("maxResults", String(BATCH));
  url.searchParams.set("key", key);

  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) {
    // Google's message names the actual problem (bad key, API not enabled, quota).
    throw new Error(`YouTube API ${response.status}: ${body?.error?.message ?? "unknown error"}`);
  }
  return body.items ?? [];
}

async function main() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    console.error("YOUTUBE_API_KEY is not set in .env.local");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

  try {
    const rows = await sql<{ youtube_id: string }[]>`
      SELECT DISTINCT youtube_id FROM videos WHERE youtube_id IS NOT NULL
    `;
    const ids = rows.map((r) => r.youtube_id);
    console.log(`${ids.length} YouTube videos to check.`);

    let updated = 0;
    const missing: string[] = [];

    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const items = await fetchBatch(batch, key);

      const found = new Set(items.map((item) => item.id));
      missing.push(...batch.filter((id) => !found.has(id)));

      const values = items.map((item) => [
        item.id,
        String(parseDuration(item.contentDetails?.duration ?? "")),
        String(Math.min(Number(item.statistics?.viewCount ?? 0), INT_MAX)),
      ]);
      if (values.length === 0) continue;

      // One statement per batch. The IS DISTINCT FROM guard skips unchanged
      // rows, so a re-run does not bump updated_at on the whole catalogue.
      const result = await sql`
        UPDATE videos AS v
        SET duration = d.duration::int,
            imported_view_count = d.views::int
        FROM (VALUES ${sql(values)}) AS d(youtube_id, duration, views)
        WHERE v.youtube_id = d.youtube_id
          AND (v.duration IS DISTINCT FROM d.duration::int
            OR v.imported_view_count IS DISTINCT FROM d.views::int)
      `;
      updated += result.count;
      console.log(`  checked ${Math.min(i + BATCH, ids.length)}/${ids.length}`);
    }

    console.log(`Done. ${updated} video(s) updated.`);
    if (missing.length > 0) {
      console.log(
        `${missing.length} not returned by YouTube (deleted or private): ${missing.join(", ")}`
      );
    }
  } catch (error) {
    console.error("Sync failed:", error instanceof Error ? error.message : error);
    await sql.end({ timeout: 5 });
    process.exit(1);
  }

  await sql.end({ timeout: 5 });
  process.exit(0);
}

main();
