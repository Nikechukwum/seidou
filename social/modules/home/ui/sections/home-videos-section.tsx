"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/social/trpc/client";
import { HOME_FEED_LIMIT } from "@/social/constants";
import { InfiniteScroll } from "@/social/components/infinite-scroll";

import { HomeVideoCard, HomeVideoCardSkeleton } from "../components/home-video-card";

interface HomeVideosSectionProps {
  categoryId?: string;
}

export const HomeVideosSection = ({ categoryId }: HomeVideosSectionProps) => {
  return (
    // ErrorBoundary outside Suspense so it can catch errors thrown by the
    // suspending component — see the note in video-section.tsx.
    //
    // `key` on the Suspense boundary, not the inner component: changing
    // category must remount and re-suspend, otherwise the old list stays on
    // screen while the new query resolves.
    <ErrorBoundary
      fallback={
        <p className="px-4 py-8 text-sm text-muted-foreground">
          Something went wrong loading videos.
        </p>
      }
    >
      <Suspense key={categoryId} fallback={<HomeVideosSectionSkeleton />}>
        <HomeVideosSectionSuspense categoryId={categoryId} />
      </Suspense>
    </ErrorBoundary>
  );
};

const HomeVideosSectionSkeleton = () => {
  return (
    <div className="grid grid-cols-2 gap-x-2.5 gap-y-2.5 px-2.5">
      {Array.from({ length: HOME_FEED_LIMIT }).map((_, i) => (
        <HomeVideoCardSkeleton key={i} />
      ))}
    </div>
  );
};

const HomeVideosSectionSuspense = ({ categoryId }: HomeVideosSectionProps) => {
  const [videos, query] = trpc.videos.getMany.useSuspenseInfiniteQuery(
    // Shorts have their own player at /shorts — the home feed shows the
    // long-form catalogue, otherwise the freshly imported shorts would fill
    // the entire first page.
    { categoryId, kind: "video", limit: HOME_FEED_LIMIT },
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
      {/* Two columns, ten to a page: on a phone the first screen holds the
          whole first page without scrolling. The metadata is overlaid on the
          thumbnail — see home-video-card.tsx — which is what buys the height. */}
      <div className="grid grid-cols-2 gap-x-2.5 gap-y-2.5 px-2.5">
        {items.map((video) => (
          <HomeVideoCard key={video.id} data={video} />
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
