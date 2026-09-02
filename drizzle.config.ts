import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./social/db/schema.ts",
  out: "./social/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // The `users` table is shared with the commerce app and is NOT owned by
  // this schema file. Never run `drizzle-kit push` against a live database:
  // generate the SQL, read it, and apply it by hand. See the plan's M1 gate.
  verbose: true,
  strict: true,
});
