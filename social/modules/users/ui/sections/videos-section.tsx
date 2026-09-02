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

interface VideosSectionProps {
  userId: string;
}

export const VideosSection = ({ userId }: VideosSectionProps) => {
  return (
    <ErrorBoundary
      fallback={
        <p className="px-4 py-8 text-sm text-muted-foreground">
          Could not load videos.
        </p>
      }
    >
      <Suspense fallback={<VideosSectionSkeleton />}>
        <VideosSectionSuspense userId={userId} />
      </Suspense>
    </ErrorBoundary>
  );
};

const VideosSectionSkeleton = () => (
  <div className="flex flex-col gap-6 px-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <VideoGridCardSkeleton key={i} />
    ))}
  </div>
);

const VideosSectionSuspense = ({ userId }: VideosSectionProps) => {
  // Reuses videos.getMany with a userId filter, which only ever returns
  // public videos — a visitor cannot see someone's drafts.
  const [videos, query] = trpc.videos.getMany.useSuspenseInfiniteQuery(
    { userId, limit: DEFAULT_LIMIT },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const items = videos.pages.flatMap((page) => page.items);

  if (items.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        This channel has no public videos yet.
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
