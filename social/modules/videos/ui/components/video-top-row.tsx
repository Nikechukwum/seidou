import { useMemo } from "react";
import { formatDistanceToNow, format } from "date-fns";

import { Skeleton } from "@/social/components/ui/skeleton";

import { VideoOwner } from "./video-owner";
import { VideoReactions } from "./video-reactions";
import { VideoDescription } from "./video-description";
import { VideoGetOneOutput } from "../../types";

interface VideoTopRowProps {
  video: VideoGetOneOutput;
}

export const VideoTopRowSkeleton = () => {
  return (
    <div className="flex flex-col gap-4 mt-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-4/5" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full shrink-0" />
        <div className="flex flex-col gap-2 w-full">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/5" />
        </div>
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  );
};

export const VideoTopRow = ({ video }: VideoTopRowProps) => {
  const compactViews = useMemo(
    () => Intl.NumberFormat("en", { notation: "compact" }).format(video.viewCount),
    [video.viewCount]
  );

  const expandedViews = useMemo(
    () => Intl.NumberFormat("en", { notation: "standard" }).format(video.viewCount),
    [video.viewCount]
  );

  const compactDate = useMemo(
    () => formatDistanceToNow(video.createdAt, { addSuffix: true }),
    [video.createdAt]
  );

  const expandedDate = useMemo(
    () => format(video.createdAt, "d MMM yyyy"),
    [video.createdAt]
  );

  return (
    <div className="flex flex-col gap-4 mt-4">
      <h1 className="text-lg font-semibold">{video.title}</h1>

      <VideoOwner user={video.user} videoId={video.id} />

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <VideoReactions
          videoId={video.id}
          likes={video.likeCount}
          dislikes={video.dislikeCount}
          viewerReaction={video.viewerReaction}
        />
      </div>

      <VideoDescription
        compactViews={compactViews}
        expandedViews={expandedViews}
        compactDate={compactDate}
        expandedDate={expandedDate}
        description={video.description}
      />
    </div>
  );
};
