"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/social/trpc/client";
import { SHORTS_FEED_LIMIT } from "@/social/constants";
import { InfiniteScroll } from "@/social/components/infinite-scroll";

import { ShortItem } from "../components/short-item";

interface ShortsFeedSectionProps {
  onAction: () => void;
}

export const ShortsFeedSection = ({ onAction }: ShortsFeedSectionProps) => {
  return (
    <ErrorBoundary
      fallback={
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Something went wrong loading shorts.
        </p>
      }
    >
      <Suspense fallback={<div className="h-[calc(100dvh-60px)] bg-black" />}>
        <ShortsFeedSectionSuspense onAction={onAction} />
      </Suspense>
    </ErrorBoundary>
  );
};

const ShortsFeedSectionSuspense = ({ onAction }: ShortsFeedSectionProps) => {
  const [shorts, query] = trpc.videos.getMany.useSuspenseInfiniteQuery(
    { kind: "short", limit: SHORTS_FEED_LIMIT },
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
      {items.map((video) => (
        <ShortItem key={video.id} video={video} onAction={onAction} />
      ))}
      <InfiniteScroll
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        fetchNextPage={query.fetchNextPage}
      />
    </div>
  );
};
