"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/social/trpc/client";
import { DEFAULT_LIMIT } from "@/social/constants";
import { InfiniteScroll } from "@/social/components/infinite-scroll";

import {
  VideoGridCard,
  VideoGridCardSkeleton,
} from "../components/video-grid-card";

interface SuggestionsSectionProps {
  videoId: string;
  isManual?: boolean;
}

export const SuggestionsSection = ({
  videoId,
  isManual,
}: SuggestionsSectionProps) => {
  // ErrorBoundary outside Suspense — see the note in video-section.tsx.
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={<SuggestionsSectionSkeleton />}>
        <SuggestionsSectionSuspense videoId={videoId} isManual={isManual} />
      </Suspense>
    </ErrorBoundary>
  );
};

const SuggestionsSectionSkeleton = () => {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <VideoGridCardSkeleton key={i} />
      ))}
    </div>
  );
};

const SuggestionsSectionSuspense = ({
  videoId,
  isManual,
}: SuggestionsSectionProps) => {
  const [suggestions, query] =
    trpc.suggestions.getMany.useSuspenseInfiniteQuery(
      { videoId, limit: DEFAULT_LIMIT },
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    );

  const items = suggestions.pages.flatMap((page) => page.items);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold">Up next</h2>
      <div className="flex flex-col gap-6">
        {items.map((video) => (
          <VideoGridCard key={video.id} data={video} />
        ))}
      </div>
      <InfiniteScroll
        isManual={isManual}
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        fetchNextPage={query.fetchNextPage}
      />
    </div>
  );
};
