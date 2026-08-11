import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/social/trpc/routers/_app";

/**
 * Inferred straight from the router, so the components cannot drift from what
 * the procedures actually return. Change a select in procedures.ts and every
 * consumer of this type fails to compile.
 */
export type VideoGetManyOutput =
  inferRouterOutputs<AppRouter>["videos"]["getMany"];
