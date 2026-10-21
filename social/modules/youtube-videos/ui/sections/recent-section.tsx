"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/social/trpc/client";

import { youtubeWatchUrl } from "../../lib/parse";
import {
  YouTubeThumbnailItem,
  YouTubeThumbnailItemSkeleton,
} from "../components/youtube-thumbnail-item";

export const RecentSection = () => {
  // ErrorBoundary outside Suspense — see the note in video-section.tsx.
  return (
    <ErrorBoundary
      fallback={
        <p className="py-8 text-sm text-muted-foreground">
          Could not load the imported videos.
        </p>
      }
    >
      <Suspense fallback={<RecentSectionSkeleton />}>
        <RecentSectionSuspense />
      </Suspense>
    </ErrorBoundary>
  );
};

const RecentSectionSkeleton = () => {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <YouTubeThumbnailItemSkeleton key={i} />
      ))}
    </div>
  );
};

const RecentSectionSuspense = () => {
  const [videos] = trpc.youtubeVideos.getRecent.useSuspenseQuery();

  if (videos.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nothing has been imported yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {videos.map((video) => (
        <YouTubeThumbnailItem
          key={video.id}
          videoUrl={youtubeWatchUrl(video.youtubeId)}
          title={video.title}
          channelName={video.actualChannelName ?? video.channelName}
          category={video.category}
        />
      ))}
    </div>
  );
};
