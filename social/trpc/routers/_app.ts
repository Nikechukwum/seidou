import { usersRouter } from '@/social/modules/users/server/procedures';
import { studioRouter } from '@/social/modules/studio/server/procedures';
import { searchRouter } from '@/social/modules/search/server/procedures';
import { playlistsRouter } from '@/social/modules/playlists/server/procedures';
import { videosRouter } from '@/social/modules/videos/server/procedures';
import { commentsRouter } from '@/social/modules/comments/server/procedures';
import { categoriesRouter } from '@/social/modules/categories/server/procedures';
import { videoViewsRouter } from '@/social/modules/video-views/server/procedures';
import { suggestionsRouter } from '@/social/modules/suggestions/server/procedures';
import { subscriptionsRouter } from '@/social/modules/subscriptions/server/procedures';
import { videoReactionsRouter } from '@/social/modules/video-reactions/server/procedures';
import { commentReactionsRouter } from '@/social/modules/comment-reactions/server/procedures';

import { createTRPCRouter } from '../init';

/** Every router. */
export const appRouter = createTRPCRouter({
  users: usersRouter,
  videos: videosRouter,
  studio: studioRouter,
  search: searchRouter,
  playlists: playlistsRouter,
  comments: commentsRouter,
  categories: categoriesRouter,
  videoViews: videoViewsRouter,
  suggestions: suggestionsRouter,
  subscriptions: subscriptionsRouter,
  videoReactions: videoReactionsRouter,
  commentReactions: commentReactionsRouter,
});

export type AppRouter = typeof appRouter;
