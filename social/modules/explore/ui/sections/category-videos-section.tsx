"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/social/trpc/client";
import { InfiniteScroll } from "@/social/components/infinite-scroll";
import {
  VideoGridCard,
  VideoGridCardSkeleton,
} from "@/social/modules/videos/ui/components/video-grid-card";

import { categoryVideosInput } from "../../constants";

interface CategoryVideosSectionProps {
  categoryId: string;
  /** "all" mixes in shorts (badged); "videos" leaves them out. */
  tab: "all" | "videos";
}

export const CategoryVideosSection = (props: CategoryVideosSectionProps) => {
  // ErrorBoundary outside Suspense so it can catch errors thrown by the
  // suspending component — see the note in video-section.tsx. Keyed so a tab
  // switch re-suspends instead of showing the previous tab's list.
  return (
    <ErrorBoundary
      fallback={
        <p className="px-4 py-8 text-sm text-muted-foreground">
          Something went wrong loading videos.
        </p>
      }
    >
      <Suspense key={props.tab} fallback={<CategoryVideosSectionSkeleton />}>
        <CategoryVideosSectionSuspense {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};

const CategoryVideosSectionSkeleton = () => {
  return (
    <div className="flex flex-col gap-6 px-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <VideoGridCardSkeleton key={i} />
      ))}
    </div>
  );
};

const CategoryVideosSectionSuspense = ({
  categoryId,
  tab,
}: CategoryVideosSectionProps) => {
  const [videos, query] = trpc.explore.getVideos.useSuspenseInfiniteQuery(
    categoryVideosInput(categoryId, tab),
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
