"use client";

import { ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";

import { cn } from "@/social/lib/utils";
import { trpc } from "@/social/trpc/client";
import { toast } from "@/social/lib/toast";
import { useViewer } from "@/social/hooks/use-viewer";

import { VideoGetOneOutput } from "../../types";

interface VideoReactionsProps {
  videoId: string;
  likes: number;
  dislikes: number;
  viewerReaction: VideoGetOneOutput["viewerReaction"];
}

export const VideoReactions = ({
  videoId,
  likes,
  dislikes,
  viewerReaction,
}: VideoReactionsProps) => {
  const utils = trpc.useUtils();
  const { requireSignIn } = useViewer();

  const onError = (error: { data?: { code?: string } | null }) => {
    if (error.data?.code === "UNAUTHORIZED") {
      // Seidou has no auth modal — it redirects and returns you afterwards.
      requireSignIn();
      return;
    }
    toast.error("Something went wrong");
  };

  const like = trpc.videoReactions.like.useMutation({
    onSuccess: () => {
      utils.videos.getOne.invalidate({ id: videoId });
    },
    onError,
  });

  const dislike = trpc.videoReactions.dislike.useMutation({
    onSuccess: () => {
      utils.videos.getOne.invalidate({ id: videoId });
    },
    onError,
  });

  const pending = like.isPending || dislike.isPending;

  return (
    <div className="flex items-center rounded-full border border-gray-200">
      <button
        onClick={() => like.mutate({ videoId })}
        disabled={pending}
        aria-label="Like"
        className="flex items-center gap-2 rounded-l-full px-4 py-2 text-sm disabled:opacity-50"
      >
        <ThumbsUpIcon
          className={cn("size-4", viewerReaction === "like" && "fill-black")}
        />
        {likes}
      </button>

      <div className="h-6 w-px bg-gray-200" />

      <button
        onClick={() => dislike.mutate({ videoId })}
        disabled={pending}
        aria-label="Dislike"
        className="flex items-center gap-2 rounded-r-full px-4 py-2 text-sm disabled:opacity-50"
      >
        <ThumbsDownIcon
          className={cn("size-4", viewerReaction === "dislike" && "fill-black")}
        />
        {dislikes}
      </button>
    </div>
  );
};
