import Link from "next/link";
import Image from "next/image";
import { ListVideoIcon, PlayIcon } from "lucide-react";

import { socialPath } from "@/social/constants";
import { Skeleton } from "@/social/components/ui/skeleton";
import { THUMBNAIL_FALLBACK } from "@/social/modules/videos/constants";

import { PlaylistGetManyOutput } from "../../types";

interface PlaylistGridCardProps {
  data: PlaylistGetManyOutput["items"][number];
}

export const PlaylistGridCardSkeleton = () => (
  <div className="flex flex-col gap-2 w-full">
    <Skeleton className="aspect-video w-full rounded-xl" />
    <Skeleton className="h-5 w-1/2" />
    <Skeleton className="h-4 w-1/3" />
  </div>
);

export const PlaylistGridCard = ({ data }: PlaylistGridCardProps) => {
  return (
    <Link prefetch href={socialPath(`/playlists/${data.id}`)}>
      <div className="flex flex-col gap-2 w-full group">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
          <Image
            src={data.thumbnailUrl || THUMBNAIL_FALLBACK}
            alt={data.name}
            fill
            className="object-cover"
          />

          {/* Stacked-cards effect, so a playlist reads differently to a video. */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/70 px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-white">
              <ListVideoIcon className="size-3.5" />
              {data.videoCount} {data.videoCount === 1 ? "video" : "videos"}
            </span>
            <PlayIcon className="size-3.5 fill-white text-white" />
          </div>
        </div>

        <div>
          <p className="line-clamp-1 text-base font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">Playlist</p>
        </div>
      </div>
    </Link>
  );
};
