import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouter } from '@/social/trpc/routers/_app';
import { createTRPCContext } from '@/social/trpc/init';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/social/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });

export { handler as GET, handler as POST };
