"use client";

import Image from "next/image";
import { useState } from "react";
import { PlayIcon } from "lucide-react";

import { Skeleton } from "@/social/components/ui/skeleton";

import { extractYoutubeId, youtubeThumbnailUrl } from "../../lib/parse";
import { YouTubePlayerOverlay } from "./youtube-player-overlay";

interface YouTubeThumbnailItemProps {
  /** Any YouTube URL, or a bare video id. */
  videoUrl: string;
  title: string;
  channelName?: string | null;
  category?: string | null;
}

export const YouTubeThumbnailItemSkeleton = () => {
  return (
    <div className="flex gap-3">
      <Skeleton className="h-20 w-36 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  );
};

/**
 * A YouTube video as a list row: thumbnail on the left, details on the right.
 * Tapping it plays the video in a full-screen overlay.
 *
 * Self-contained — it needs only the URL and a title, and owns its own
 * overlay — so it can be dropped into any list.
 */
export const YouTubeThumbnailItem = ({
  videoUrl,
  title,
  channelName,
  category,
}: YouTubeThumbnailItemProps) => {
  const [open, setOpen] = useState(false);
  const videoId = extractYoutubeId(videoUrl);

  if (!videoId) return null;

  const details = [channelName, category].filter(Boolean).join(" • ");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full gap-3 text-left"
      >
        <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-lg bg-muted">
          <Image
            src={youtubeThumbnailUrl(videoId)}
            alt={title}
            fill
            // w-36 in the list, so a viewport-wide source is wasted.
            sizes="144px"
            quality={65}
            className="object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex size-8 items-center justify-center rounded-full bg-black/70">
              <PlayIcon className="size-4 fill-white text-white" />
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 py-0.5">
          <p className="line-clamp-2 text-sm font-medium">{title}</p>
          {details && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {details}
            </p>
          )}
        </div>
      </button>

      <YouTubePlayerOverlay
        videoId={videoId}
        title={title}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
};
