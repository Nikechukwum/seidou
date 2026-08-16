"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { format } from "date-fns";
import { Globe2Icon, LockIcon } from "lucide-react";

import { trpc } from "@/social/trpc/client";
import { DEFAULT_LIMIT, socialPath } from "@/social/constants";
import { formatDuration, snakeCaseToTitle } from "@/social/lib/utils";
import { Skeleton } from "@/social/components/ui/skeleton";
import { InfiniteScroll } from "@/social/components/infinite-scroll";
import { THUMBNAIL_FALLBACK } from "@/social/modules/videos/constants";

export const VideosSection = () => {
  // ErrorBoundary outside Suspense — see the note in video-section.tsx.
  return (
    <ErrorBoundary
      fallback={
        <p className="px-4 py-8 text-sm text-muted-foreground">
          Could not load your videos.
        </p>
      }
    >
      <Suspense fallback={<VideosSectionSkeleton />}>
        <VideosSectionSuspense />
      </Suspense>
    </ErrorBoundary>
  );
};

const VideosSectionSkeleton = () => {
  return (
    <div className="flex flex-col gap-4 px-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-20 w-36 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
};

const VideosSectionSuspense = () => {
  const [videos, query] = trpc.studio.getMany.useSuspenseInfiniteQuery(
    { limit: DEFAULT_LIMIT },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const items = videos.pages.flatMap((page) => page.items);

  if (items.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          You have not uploaded any videos yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 px-4">
        {items.map((video) => (
          <Link
            prefetch
            key={video.id}
            href={socialPath(`/studio/videos/${video.id}`)}
            className="flex gap-3"
          >
            <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-lg bg-muted">
              <Image
                src={video.thumbnailUrl || THUMBNAIL_FALLBACK}
                alt={video.title}
                fill
                className="object-cover"
              />
              <div className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-medium text-white">
                {formatDuration(video.duration)}
              </div>
            </div>

            <div className="min-w-0 flex-1 py-0.5">
              <p className="line-clamp-1 text-sm font-medium">{video.title}</p>

              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                {video.visibility === "public" ? (
                  <Globe2Icon className="size-3" />
                ) : (
                  <LockIcon className="size-3" />
                )}
                {snakeCaseToTitle(video.visibility)}
                <span>•</span>
                {snakeCaseToTitle(video.muxStatus || "waiting")}
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                {format(video.createdAt, "d MMM yyyy")} • {video.viewCount} views
                • {video.commentCount} comments
              </p>
            </div>
          </Link>
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
