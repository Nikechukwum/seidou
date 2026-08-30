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

export const LikedVideosSection = () => {
  return (
    <ErrorBoundary
      fallback={
        <p className="px-4 py-8 text-sm text-muted-foreground">
          Could not load your liked videos.
        </p>
      }
    >
      <Suspense fallback={<Skeleton />}>
        <LikedVideosSectionSuspense />
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

const LikedVideosSectionSuspense = () => {
  // Ordered by when you liked it, not when the video was updated.
  const [videos, query] = trpc.playlists.getLiked.useSuspenseInfiniteQuery(
    { limit: DEFAULT_LIMIT },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const items = videos.pages.flatMap((page) => page.items);

  if (items.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        Videos you like will appear here.
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
