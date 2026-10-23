"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/social/trpc/client";
import { InfiniteScroll } from "@/social/components/infinite-scroll";

import { categoryVideosInput } from "../../constants";
import { ShortCard, ShortCardSkeleton } from "../components/short-card";

interface CategoryShortsSectionProps {
  categoryId: string;
}

export const CategoryShortsSection = (props: CategoryShortsSectionProps) => {
  return (
    <ErrorBoundary
      fallback={
        <p className="px-4 py-8 text-sm text-muted-foreground">
          Something went wrong loading shorts.
        </p>
      }
    >
      <Suspense fallback={<CategoryShortsSectionSkeleton />}>
        <CategoryShortsSectionSuspense {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};

const CategoryShortsSectionSkeleton = () => {
  return (
    <div className="grid grid-cols-2 gap-2 px-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <ShortCardSkeleton key={i} />
      ))}
    </div>
  );
};

const CategoryShortsSectionSuspense = ({
  categoryId,
}: CategoryShortsSectionProps) => {
  const [shorts, query] = trpc.explore.getVideos.useSuspenseInfiniteQuery(
    categoryVideosInput(categoryId, "shorts"),
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const items = shorts.pages.flatMap((page) => page.items);

  if (items.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        No shorts here yet.
      </p>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 px-3">
        {items.map((video) => (
          <ShortCard key={video.id} data={video} />
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
