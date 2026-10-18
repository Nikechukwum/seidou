"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/social/trpc/client";
import { Skeleton } from "@/social/components/ui/skeleton";
import { UserAvatar } from "@/social/components/user-avatar";
import { VideoBackBar } from "@/social/modules/videos/ui/components/video-back-bar";

import { YouTubeGridCard } from "../components/youtube-grid-card";

/**
 * Watch page for an imported YouTube video. Same shape as the upload watch
 * page — player edge to edge at the top with the back bar over it, details
 * below, then more videos — but played in YouTube's embed. There are no likes
 * or comments: those are built for Seidou's own uploads.
 */
export const YouTubeVideoView = ({ youtubeId }: { youtubeId: string }) => {
  return (
    <div className="relative min-h-lvh bg-white pb-20">
      <VideoBackBar />
      <ErrorBoundary fallback={<p className="px-4 pt-20 text-sm text-muted-foreground">Could not load this video.</p>}>
        {/* key: moving to another video from "More videos" remounts the player */}
        <Suspense key={youtubeId} fallback={<YouTubeVideoSkeleton />}>
          <YouTubeVideoSuspense youtubeId={youtubeId} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

const YouTubeVideoSkeleton = () => (
  <div className="flex flex-col gap-4">
    <Skeleton className="aspect-video w-full rounded-none" />
    <div className="space-y-3 px-4">
      <Skeleton className="h-6 w-4/5" />
      <Skeleton className="h-10 w-1/2" />
    </div>
  </div>
);

const YouTubeVideoSuspense = ({ youtubeId }: { youtubeId: string }) => {
  const [video] = trpc.youtubeVideos.getOne.useSuspenseQuery({ youtubeId });
  const [more] = trpc.youtubeVideos.getMore.useSuspenseQuery({ youtubeId, limit: 20 });

  const channelName = video.channel?.name ?? video.channelName ?? "YouTube";

  return (
    <div className="flex flex-col gap-6">
      <div className="aspect-video w-full bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?rel=0&playsinline=1`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>

      <div className="space-y-4 px-4">
        <h1 className="break-words text-xl font-bold leading-snug">{video.title}</h1>

        <div className="flex items-center gap-3">
          <UserAvatar imageUrl={video.channel?.avatarUrl} name={channelName} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{channelName}</p>
            {video.channel?.subscribersText && (
              <p className="truncate text-xs text-muted-foreground">{video.channel.subscribersText}</p>
            )}
          </div>
        </div>

        {video.category && (
          <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            {video.category}
          </span>
        )}
      </div>

      {more.length > 0 && (
        <div className="space-y-4 px-4">
          <p className="text-base font-bold">
            {video.channel ? `More from ${channelName}` : "More videos"}
          </p>
          <div className="flex flex-col gap-6">
            {more.map((item) => (
              <YouTubeGridCard key={item.id} data={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
