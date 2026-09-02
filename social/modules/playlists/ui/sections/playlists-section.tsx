"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/social/trpc/client";
import { DEFAULT_LIMIT } from "@/social/constants";
import { InfiniteScroll } from "@/social/components/infinite-scroll";

import {
  PlaylistGridCard,
  PlaylistGridCardSkeleton,
} from "../components/playlist-grid-card";

export const PlaylistsSection = () => {
  // ErrorBoundary outside Suspense — see the note in video-section.tsx.
  return (
    <ErrorBoundary
      fallback={
        <p className="px-4 py-8 text-sm text-muted-foreground">
          Could not load your playlists.
        </p>
      }
    >
      <Suspense fallback={<PlaylistsSectionSkeleton />}>
        <PlaylistsSectionSuspense />
      </Suspense>
    </ErrorBoundary>
  );
};

const PlaylistsSectionSkeleton = () => (
  <div className="flex flex-col gap-6 px-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <PlaylistGridCardSkeleton key={i} />
    ))}
  </div>
);

const PlaylistsSectionSuspense = () => {
  const [playlists, query] = trpc.playlists.getMany.useSuspenseInfiniteQuery(
    { limit: DEFAULT_LIMIT },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const items = playlists.pages.flatMap((page) => page.items);

  if (items.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        No playlists yet.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-6 px-4">
        {items.map((playlist) => (
          <PlaylistGridCard key={playlist.id} data={playlist} />
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
