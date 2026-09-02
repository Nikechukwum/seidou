"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { cn } from "@/social/lib/utils";
import { trpc } from "@/social/trpc/client";
import { useViewer } from "@/social/hooks/use-viewer";

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
  const { isSignedIn } = useViewer();
  const utils = trpc.useUtils();
  const [video] = trpc.videos.getOne.useSuspenseQuery({ id: videoId });

  const createView = trpc.videoViews.create.useMutation({
    onSuccess: () => {
      utils.videos.getOne.invalidate({ id: videoId });
    },
  });

  // video_views is keyed on (user_id, video_id), so the insert is idempotent
  // and replays do not inflate the count. Anonymous views are not recorded at
  // all — see the deferred list in docs/seidou-social.md.
  const handlePlay = () => {
    if (!isSignedIn) return;
    createView.mutate({ videoId });
  };

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
          onPlay={handlePlay}
        />
      </div>
      <VideoBanner status={video.muxStatus} />
      <VideoTopRow video={video} />
    </>
  );
};
