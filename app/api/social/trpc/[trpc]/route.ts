import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouter } from '@/social/trpc/routers/_app';
import { createTRPCContext } from '@/social/trpc/init';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/social/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
    // Without this a server failure reaches the browser only as
    // INTERNAL_SERVER_ERROR and its real cause is never printed anywhere.
    onError: ({ path, error }) => {
      console.error(`[trpc] ${path ?? '<unknown>'} failed:`, error.cause ?? error);
    },
  });

export { handler as GET, handler as POST };
