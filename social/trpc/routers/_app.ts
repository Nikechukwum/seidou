import { videosRouter } from '@/social/modules/videos/server/procedures';
import { categoriesRouter } from '@/social/modules/categories/server/procedures';
import { suggestionsRouter } from '@/social/modules/suggestions/server/procedures';

import { createTRPCRouter } from '../init';

/**
 * Routers are added here as each module is ported. Remaining for v1:
 * users, studio, search, comments, videoViews, subscriptions,
 * videoReactions, commentReactions.
 *
 * `playlists` is deferred — see docs/seidou-social.md.
 */
export const appRouter = createTRPCRouter({
  videos: videosRouter,
  categories: categoriesRouter,
  suggestions: suggestionsRouter,
});

export type AppRouter = typeof appRouter;
