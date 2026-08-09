import 'server-only'; // <-- ensure this file cannot be imported from the client
import { createHydrationHelpers } from '@trpc/react-query/rsc';
import { cache } from 'react';

import { createCallerFactory, createTRPCContext } from './init';
import { makeQueryClient } from './query-client';
import { appRouter } from './routers/_app';

// Stable per-request query client, so prefetches in a page and the hydration
// boundary that reads them share one cache.
export const getQueryClient = cache(makeQueryClient);

// A direct caller — server components invoke procedures as functions rather
// than making an HTTP round-trip back into the app.
const caller = createCallerFactory(appRouter)(createTRPCContext);

export const { trpc, HydrateClient } = createHydrationHelpers<typeof appRouter>(
  caller,
  getQueryClient,
);
