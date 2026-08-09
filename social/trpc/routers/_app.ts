import { categoriesRouter } from '@/social/modules/categories/server/procedures';

import { createTRPCRouter } from '../init';

/**
 * Routers are added here as each module is ported. Remaining for v1:
 * users, studio, videos, search, comments, videoViews, suggestions,
 * subscriptions, videoReactions, commentReactions.
 *
 * `playlists` is deferred — see docs/seidou-social.md.
 */
export const appRouter = createTRPCRouter({
  categories: categoriesRouter,
});

export type AppRouter = typeof appRouter;
