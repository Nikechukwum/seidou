"use client";

import Link from "next/link";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/social/trpc/client";
import { socialPath } from "@/social/constants";
import { Skeleton } from "@/social/components/ui/skeleton";
import { UserAvatar } from "@/social/components/user-avatar";
import { InfiniteScroll } from "@/social/components/infinite-scroll";

import { CATEGORY_PAGE_SIZE } from "../../constants";

interface CategoryChannelsSectionProps {
  categoryId: string;
}

export const CategoryChannelsSection = (props: CategoryChannelsSectionProps) => {
  return (
    <ErrorBoundary
      fallback={
        <p className="px-4 py-8 text-sm text-muted-foreground">
          Something went wrong loading channels.
        </p>
      }
    >
      <Suspense fallback={<CategoryChannelsSectionSkeleton />}>
        <CategoryChannelsSectionSuspense {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};

const CategoryChannelsSectionSkeleton = () => {
  return (
    <div className="flex flex-col gap-4 px-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-12 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
};

const CategoryChannelsSectionSuspense = ({
  categoryId,
}: CategoryChannelsSectionProps) => {
  const [channels, query] = trpc.explore.getChannels.useSuspenseInfiniteQuery(
    { categoryId, limit: CATEGORY_PAGE_SIZE },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const items = channels.pages.flatMap((page) => page.items);

  if (items.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        No channels here yet.
      </p>
    );
  }

  return (
    <div>
      <ul className="flex flex-col gap-1 px-2">
        {items.map((channel) => (
          <li key={channel.id}>
            <Link
              prefetch
              href={socialPath(`/users/${channel.id}`)}
              className="flex items-center gap-3 rounded-xl px-2 py-2 active:bg-gray-50"
            >
              <UserAvatar size="lg" imageUrl={channel.imageUrl} name={channel.name} />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{channel.name}</p>
                <p className="text-xs text-muted-foreground">
                  {channel.videoCount}{" "}
                  {channel.videoCount === 1 ? "video" : "videos"}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <InfiniteScroll
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        fetchNextPage={query.fetchNextPage}
      />
    </div>
  );
};
