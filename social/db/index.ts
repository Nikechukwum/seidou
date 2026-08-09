import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * Direct Postgres connection to the same Supabase database the commerce app
 * reaches through supabase-js. Not a second database — supabase-js goes in
 * via PostgREST over HTTPS, this goes in over the Postgres wire protocol.
 *
 * Connects as the service role, which bypasses RLS. That is deliberate and
 * only safe because the social tables have RLS enabled with zero policies:
 * nothing else can reach them, and authorization is enforced by
 * protectedProcedure in the tRPC layer. See migrations/0000_seidou_social.sql.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Supabase Dashboard > Connect > Transaction pooler."
  );
}

// Reuse the pool across hot reloads. Without this, every HMR cycle in dev
// opens a fresh pool and the connection limit is exhausted quickly.
const globalForDb = globalThis as unknown as {
  __seidouSocialPg?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__seidouSocialPg ??
  postgres(connectionString, {
    // Required on Supabase's transaction pooler (port 6543): it multiplexes
    // connections, so server-side prepared statements would collide with
    // "prepared statement already exists" errors.
    prepare: false,
    max: 1,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__seidouSocialPg = client;
}

export const db = drizzle(client, { schema });
