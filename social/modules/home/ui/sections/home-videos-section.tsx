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

interface HomeVideosSectionProps {
  categoryId?: string;
}

export const HomeVideosSection = ({ categoryId }: HomeVideosSectionProps) => {
  return (
    // `key` on the Suspense boundary, not the inner component: changing
    // category must remount and re-suspend, otherwise the old list stays on
    // screen while the new query resolves.
    <Suspense key={categoryId} fallback={<HomeVideosSectionSkeleton />}>
      <ErrorBoundary
        fallback={
          <p className="px-4 py-8 text-sm text-muted-foreground">
            Something went wrong loading videos.
          </p>
        }
      >
        <HomeVideosSectionSuspense categoryId={categoryId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const HomeVideosSectionSkeleton = () => {
  return (
    <div className="flex flex-col gap-6 px-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <VideoGridCardSkeleton key={i} />
      ))}
    </div>
  );
};

const HomeVideosSectionSuspense = ({ categoryId }: HomeVideosSectionProps) => {
  const [videos, query] = trpc.videos.getMany.useSuspenseInfiniteQuery(
    { categoryId, limit: DEFAULT_LIMIT },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const items = videos.pages.flatMap((page) => page.items);

  if (items.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        No videos here yet.
      </p>
    );
  }

  return (
    <div>
      {/* Single column: the shell is max-w-md, so a grid has nowhere to go. */}
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
