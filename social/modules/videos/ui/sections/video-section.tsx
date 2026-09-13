"use client";

import { Suspense, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/social/trpc/client";
import { useViewer } from "@/social/hooks/use-viewer";
import { useWatchReward } from "@/social/modules/watch-rewards/hooks/use-watch-reward";

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
      <div className="px-4">
        <VideoTopRowSkeleton />
      </div>
    </>
  );
};

const VideoSectionSuspense = ({ videoId }: VideoSectionProps) => {
  const { isSignedIn, isLoaded, viewerId } = useViewer();
  const utils = trpc.useUtils();
  const [video] = trpc.videos.getOne.useSuspenseQuery({ id: videoId });

  // Loyalty reward for watch time. These conditions only avoid pointless
  // requests — the server re-checks every one of them.
  const watchRewardHandlers = useWatchReward({
    videoId,
    enabled:
      isLoaded &&
      isSignedIn &&
      viewerId !== video.userId &&
      video.visibility === "public" &&
      video.muxStatus === "ready",
  });

  // Dev-only: shows which condition makes a video (in)eligible while testing.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !isLoaded) return;
    console.log("[watch-rewards] eligibility", {
      signedIn: isSignedIn,
      ownVideo: viewerId === video.userId,
      visibility: video.visibility,
      muxStatus: video.muxStatus,
    });
  }, [isLoaded, isSignedIn, viewerId, video.userId, video.visibility, video.muxStatus]);

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
      {/* Edge to edge with no rounding: the player is the top of the page
          (see VideoView). The processing banner stays attached beneath it. */}
      <div>
        <div className="aspect-video bg-black overflow-hidden relative">
          <VideoPlayer
            playbackId={video.muxPlaybackId}
            thumbnailUrl={video.thumbnailUrl}
            onPlay={handlePlay}
            {...watchRewardHandlers}
          />
        </div>
        <VideoBanner status={video.muxStatus} />
      </div>
      <div className="px-4">
        <VideoTopRow video={video} />
      </div>
    </>
  );
};
