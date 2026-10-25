import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { inArray, sql } from "drizzle-orm";
import { z } from "zod";

import {
  categories,
  socialProfiles,
  users,
  videos,
} from "@/social/db/schema";
import {
  SOCIAL_CATEGORIES,
  toCategorySlug,
} from "@/social/modules/explore/constants";

/**
 * Loads catalogue videos from JSON files into the videos table.
 *
 *   npm run social:import-videos -- data/music.json data/sports.json
 *
 * Each file is an array of objects (see videos.example.json):
 *
 *   title            required
 *   channel          required — "ESPN FC". Becomes a placeholder user, one per
 *                    channel, found again on later imports by its name.
 *   video_url        required — YouTube link or direct video file
 *   category         required — "Sports"; matched case-insensitively against
 *                    categories.name, created if missing
 *   id               optional — stable id from the source; falls back to
 *                    video_url. Re-importing the same id UPDATES the row, so
 *                    files can be re-run safely.
 *   views            optional — number shown as the view count
 *   thumbnail_url    optional
 *   channel_avatar_url optional
 *   description      optional
 *   kind             optional — "video" | "short"; /shorts/ URLs default to short
 *   duration         optional — seconds
 *   created_at       optional — ISO date; drives "3 days ago" and feed order
 *
 * Opens its own connection rather than importing `@/social/db`, which is
 * marked `server-only` and throws outside a Next.js server context.
 */

const rowSchema = z.object({
  id: z.coerce.string().min(1).optional(),
  title: z.string().trim().min(1),
  channel: z.string().trim().min(1),
  video_url: z.string().url(),
  category: z.string().trim().min(1),
  views: z.coerce.number().int().nonnegative().optional(),
  thumbnail_url: z.string().url().nullish(),
  channel_avatar_url: z.string().url().nullish(),
  description: z.string().nullish(),
  kind: z.enum(["video", "short"]).optional(),
  duration: z.coerce.number().nonnegative().optional(),
  created_at: z.coerce.date().optional(),
});

type Row = z.infer<typeof rowSchema>;

const BATCH_SIZE = 500;

/** "sports" -> "Sports", "movies & shows" -> "Movies & Shows" for known ones. */
const canonicalCategoryName = (raw: string) => {
  const known = SOCIAL_CATEGORIES.find(
    (c) => c.name.toLowerCase() === raw.toLowerCase() || c.slug === toCategorySlug(raw)
  );
  return known?.name ?? raw;
};

const readRows = (files: string[]) => {
  const rows: Row[] = [];
  let skipped = 0;

  for (const file of files) {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!Array.isArray(parsed)) {
      throw new Error(`${file}: expected a JSON array of videos`);
    }

    parsed.forEach((item, index) => {
      const result = rowSchema.safeParse(item);
      if (result.success) {
        rows.push(result.data);
      } else {
        skipped++;
        const issue = result.error.issues[0];
        console.warn(`  skip ${file}[${index}]: ${issue.path.join(".")} ${issue.message}`);
      }
    });
  }

  return { rows, skipped };
};

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: npm run social:import-videos -- <file.json> [more.json ...]");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  const { rows, skipped } = readRows(files);
  console.log(`Read ${rows.length} videos (${skipped} skipped) from ${files.length} file(s).`);
  if (rows.length === 0) process.exit(skipped > 0 ? 1 : 0);

  const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
  const db = drizzle(client);

  try {
    // Channels are placeholder rows in public.users. If that table's id is
    // tied to auth.users, every insert would fail one by one — stop early.
    const authFks = await db.execute<{ conname: string }>(sql`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.users'::regclass
        AND contype = 'f'
        AND confrelid = 'auth.users'::regclass
    `);
    if (authFks.length > 0) {
      throw new Error(
        `public.users.id references auth.users (${authFks.map((r) => r.conname).join(", ")}), ` +
          "so imported channels cannot be stored as users. See migrations/0004_catalogue.sql."
      );
    }

    // --- categories ---
    const categoryNames = [...new Set(rows.map((r) => canonicalCategoryName(r.category)))];
    await db
      .insert(categories)
      .values(categoryNames.map((name) => ({ name, description: `Videos related to ${name.toLowerCase()}` })))
      .onConflictDoNothing();
    const categoryRows = await db.select({ id: categories.id, name: categories.name }).from(categories);
    const categoryIdByName = new Map(categoryRows.map((c) => [c.name.toLowerCase(), c.id]));

    // --- channels ---
    const channels = new Map<string, { name: string; avatar: string }>();
    for (const row of rows) {
      const key = toCategorySlug(row.channel);
      if (!channels.has(key)) {
        channels.set(key, { name: row.channel, avatar: row.channel_avatar_url ?? "" });
      }
    }

    const existing = await db
      .select({ userId: socialProfiles.userId, channelKey: socialProfiles.channelKey })
      .from(socialProfiles)
      .where(inArray(socialProfiles.channelKey, [...channels.keys()]));
    const userIdByChannel = new Map(existing.map((p) => [p.channelKey!, p.userId]));

    let createdChannels = 0;
    for (const [key, channel] of channels) {
      if (userIdByChannel.has(key)) continue;
      const userId = randomUUID();
      await db.transaction(async (tx) => {
        await tx.insert(users).values({ id: userId, name: channel.name, imageUrl: channel.avatar });
        await tx.insert(socialProfiles).values({ userId, channelKey: key });
      });
      userIdByChannel.set(key, userId);
      createdChannels++;
    }

    // --- videos ---
    // Timestamps are always set here, never left to now(). Feeds page on a
    // (timestamp, id) cursor that round-trips through a JS Date, which only
    // holds milliseconds — a batch sharing one microsecond now() would compare
    // as newer than its own cursor, and page 2 would skip the rest of it.
    const importedAt = new Date();
    const values = rows.map((row) => ({
      externalId: row.id ?? row.video_url,
      title: row.title,
      description: row.description ?? null,
      sourceUrl: row.video_url,
      thumbnailUrl: row.thumbnail_url ?? null,
      importedViewCount: row.views ?? 0,
      kind: row.kind ?? (/\/shorts\//.test(row.video_url) ? "short" : "video") as "video" | "short",
      // Stored in milliseconds, like Mux uploads.
      duration: Math.round((row.duration ?? 0) * 1000),
      visibility: "public" as const,
      userId: userIdByChannel.get(toCategorySlug(row.channel))!,
      categoryId: categoryIdByName.get(canonicalCategoryName(row.category).toLowerCase()) ?? null,
      createdAt: row.created_at ?? importedAt,
      updatedAt: importedAt,
    }));

    // A file listing the same id twice would make one INSERT ... ON CONFLICT
    // touch a row twice, which Postgres rejects. Last one wins.
    const deduped = [...new Map(values.map((v) => [v.externalId, v])).values()];

    for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
      const batch = deduped.slice(i, i + BATCH_SIZE);
      await db
        .insert(videos)
        .values(batch)
        .onConflictDoUpdate({
          target: videos.externalId,
          set: {
            title: sql`excluded.title`,
            description: sql`excluded.description`,
            sourceUrl: sql`excluded.source_url`,
            thumbnailUrl: sql`excluded.thumbnail_url`,
            importedViewCount: sql`excluded.imported_view_count`,
            kind: sql`excluded.kind`,
            duration: sql`excluded.duration`,
            userId: sql`excluded.user_id`,
            categoryId: sql`excluded.category_id`,
            createdAt: sql`excluded.created_at`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      console.log(`  upserted ${Math.min(i + BATCH_SIZE, deduped.length)}/${deduped.length}`);
    }

    console.log(
      `Done. ${deduped.length} videos upserted, ${createdChannels} new channel(s), ${categoryNames.length} categor(ies) referenced.`
    );
  } catch (error) {
    console.error("Import failed:", error instanceof Error ? error.message : error);
    await client.end({ timeout: 5 });
    process.exit(1);
  }

  await client.end({ timeout: 5 });
  process.exit(0);
}

main();
