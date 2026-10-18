import Image from "next/image";
import Link from "next/link";

import { socialPath } from "@/social/constants";
import { UserAvatar } from "@/social/components/user-avatar";

import { youtubeThumbnailUrl } from "../../lib/parse";

export interface YouTubeGridCardData {
  youtubeId: string;
  title: string;
  category: string | null;
  channelName: string | null;
  channelAvatarUrl: string | null;
}

/** Where an imported video's watch page lives. */
export const youtubeWatchPath = (youtubeId: string) => socialPath(`/youtube/${youtubeId}`);

/**
 * An imported YouTube video in the feed. Laid out like VideoGridCard — full
 * width thumbnail, then avatar + title + channel — so the two read as one
 * feed. It has no duration or view count (YouTube's are not imported), and a
 * small badge marks it as YouTube.
 */
export const YouTubeGridCard = ({ data }: { data: YouTubeGridCardData }) => {
  const href = youtubeWatchPath(data.youtubeId);
  const channel = data.channelName ?? "YouTube";

  return (
    <div className="flex w-full flex-col gap-2">
      <Link prefetch href={href}>
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
          <Image
            src={youtubeThumbnailUrl(data.youtubeId)}
            alt={data.title}
            fill
            sizes="(max-width: 448px) 100vw, 448px"
            quality={65}
            className="h-full w-full object-cover"
          />
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            YouTube
          </span>
        </div>
      </Link>
      <div className="flex gap-3">
        <Link prefetch href={href}>
          <UserAvatar imageUrl={data.channelAvatarUrl} name={channel} />
        </Link>
        <Link prefetch href={href} className="min-w-0 flex-1">
          <h3 className="line-clamp-2 break-words text-base font-medium">{data.title}</h3>
          <p className="line-clamp-1 text-sm text-gray-600">
            {[channel, data.category].filter(Boolean).join(" • ")}
          </p>
        </Link>
      </div>
    </div>
  );
};
