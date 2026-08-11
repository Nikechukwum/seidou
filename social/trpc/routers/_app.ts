import { videosRouter } from '@/social/modules/videos/server/procedures';
import { categoriesRouter } from '@/social/modules/categories/server/procedures';

import { createTRPCRouter } from '../init';

/**
 * Routers are added here as each module is ported. Remaining for v1:
 * users, studio, search, comments, videoViews, suggestions,
 * subscriptions, videoReactions, commentReactions.
 *
 * `playlists` is deferred — see docs/seidou-social.md.
 */
export const appRouter = createTRPCRouter({
  videos: videosRouter,
  categories: categoriesRouter,
});

export type AppRouter = typeof appRouter;
