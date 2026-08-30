import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import { categories } from "@/social/db/schema";

/**
 * Opens its own connection rather than importing `@/social/db`, which is
 * marked `server-only` and throws outside a Next.js server context.
 *
 * Run with: npm run social:seed-categories
 */

const categoryNames = [
  "Cars and vehicles",
  "Comedy",
  "Education",
  "Gaming",
  "Entertainment",
  "Film and animation",
  "How-to and style",
  "Music",
  "News and politics",
  "People and blogs",
  "Pets and animals",
  "Science and technology",
  "Sports",
  "Travel and events",
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
  const db = drizzle(client);

  console.log("Seeding categories...");

  try {
    const values = categoryNames.map((name) => ({
      name,
      description: `Videos related to ${name.toLowerCase()}`,
    }));

    // Idempotent: `name` is unique, so re-running adds only what is missing
    // rather than failing on a duplicate.
    await db.insert(categories).values(values).onConflictDoNothing();

    const rows = await db.select().from(categories);
    console.log(`Done. ${rows.length} categories in the database.`);
  } catch (error) {
    console.error("Error seeding categories: ", error);
    await client.end({ timeout: 5 });
    process.exit(1);
  }

  await client.end({ timeout: 5 });
  process.exit(0);
}

main();
