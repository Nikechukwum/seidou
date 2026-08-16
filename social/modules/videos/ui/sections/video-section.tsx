"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { cn } from "@/social/lib/utils";
import { trpc } from "@/social/trpc/client";

import { VideoPlayer, VideoPlayerSkeleton } from "../components/video-player";
import { VideoBanner } from "../components/video-banner";
import { VideoTopRow, VideoTopRowSkeleton } from "../components/video-top-row";

interface VideoSectionProps {
  videoId: string;
}

export const VideoSection = ({ videoId }: VideoSectionProps) => {
  // ErrorBoundary must wrap Suspense, not sit inside it. Nested the other way
  // (as upstream had it) it cannot catch an error thrown by the suspending
  // component: a deleted or private video rendered a blank page rather than a
  // message, because React aborted the boundary during streaming SSR.
  return (
    <ErrorBoundary
      fallback={
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            This video is unavailable.
          </p>
        </div>
      }
    >
      <Suspense fallback={<VideoSectionSkeleton />}>
        <VideoSectionSuspense videoId={videoId} />
      </Suspense>
    </ErrorBoundary>
  );
};

const VideoSectionSkeleton = () => {
  return (
    <>
      <VideoPlayerSkeleton />
      <VideoTopRowSkeleton />
    </>
  );
};

const VideoSectionSuspense = ({ videoId }: VideoSectionProps) => {
  const [video] = trpc.videos.getOne.useSuspenseQuery({ id: videoId });

  return (
    <>
      <div
        className={cn(
          "aspect-video bg-black rounded-xl overflow-hidden relative",
          video.muxStatus !== "ready" && "rounded-b-none"
        )}
      >
        <VideoPlayer
          playbackId={video.muxPlaybackId}
          thumbnailUrl={video.thumbnailUrl}
        />
      </div>
      <VideoBanner status={video.muxStatus} />
      <VideoTopRow video={video} />
      {/* View tracking (videoViews.create) lands with M6. */}
    </>
  );
};
