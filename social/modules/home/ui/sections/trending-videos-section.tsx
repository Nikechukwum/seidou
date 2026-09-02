"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/social/trpc/client";
import { DEFAULT_LIMIT } from "@/social/constants";
import { InfiniteScroll } from "@/social/components/infinite-scroll";
import {
  VideoGridCard,
  VideoGridCardSkeleton,
} from "@/social/modules/videos/ui/components/video-grid-card";

export const TrendingVideosSection = () => {
  return (
    <ErrorBoundary
      fallback={
        <p className="px-4 py-8 text-sm text-muted-foreground">
          Could not load trending videos.
        </p>
      }
    >
      <Suspense fallback={<Skeleton />}>
        <TrendingVideosSectionSuspense />
      </Suspense>
    </ErrorBoundary>
  );
};

const Skeleton = () => (
  <div className="flex flex-col gap-6 px-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <VideoGridCardSkeleton key={i} />
    ))}
  </div>
);

const TrendingVideosSectionSuspense = () => {
  // Ordered by view count rather than recency — the cursor keys on
  // (viewCount, id), so ties fall back to id and pagination stays stable.
  const [videos, query] = trpc.videos.getManyTrending.useSuspenseInfiniteQuery(
    { limit: DEFAULT_LIMIT },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const items = videos.pages.flatMap((page) => page.items);

  if (items.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        Nothing trending yet.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-6 px-4">
        {items.map((video) => (
          <VideoGridCard key={video.id} data={video} />
        ))}
      </div>
      <InfiniteScroll
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        fetchNextPage={query.fetchNextPage}
      />
    </div>
  );
};
