import { cache } from "react";
import { eq } from "drizzle-orm";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import { db } from "@/social/db";
import { users, socialUserColumns } from "@/social/db/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * Request context.
 *
 * The upstream project read a Clerk session here. Seidou authenticates with
 * Supabase, so this reads the Supabase session instead — reusing the existing
 * server client in lib/supabase/server.ts, which is also what the commerce app
 * uses.
 *
 * `authUserId` is auth.users.id, which is also public.users.id — social does
 * not have a separate identity column.
 */
export const createTRPCContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { authUserId: user?.id ?? null };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/** Unauthenticated. Procedures needing optional viewer state resolve it themselves. */
export const baseProcedure = t.procedure;

/**
 * Requires a signed-in user who also has a public.users profile row.
 *
 * The profile row is created at signup (app/signup/page.tsx). If that insert
 * ever failed, the account exists with no row and lands here as UNAUTHORIZED —
 * see the deferred "guarantee the profile row" item in docs/seidou-social.md.
 *
 * Selects socialUserColumns rather than the whole row: `ctx.user` flows into
 * procedure responses, and the full row carries commerce fields like
 * cash_balance, phone and dob.
 *
 * The upstream rate limiter (Upstash Redis) is deliberately not ported — see
 * the deferred list. This is the single place to reintroduce it.
 */
export const protectedProcedure = t.procedure.use(async function isAuthed(opts) {
  const { ctx } = opts;

  if (!ctx.authUserId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const [user] = await db
    .select(socialUserColumns)
    .from(users)
    .where(eq(users.id, ctx.authUserId))
    .limit(1);

  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return opts.next({
    ctx: {
      ...ctx,
      user,
    },
  });
});
