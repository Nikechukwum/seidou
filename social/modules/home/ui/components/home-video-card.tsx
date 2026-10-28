import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";

import { socialPath } from "@/social/constants";
import { formatDuration } from "@/social/lib/utils";
import { isOptimizableImage } from "@/social/lib/image";
import { Skeleton } from "@/social/components/ui/skeleton";
import { THUMBNAIL_FALLBACK } from "@/social/modules/videos/constants";

import { VideoGetManyOutput } from "../../../videos/types";

type HomeVideo = VideoGetManyOutput["items"][number];

/**
 * Home feed tile: the thumbnail is the card.
 *
 * The title, channel and view count sit on a scrim over the image rather than
 * in a block underneath. That is what lets ten cards fit on the first screen
 * without shrinking the artwork — a 16:9 image plus three lines of text was
 * already taller than the space between the header and the footer.
 */
export const HomeVideoCard = ({ data }: { data: HomeVideo }) => {
  const poster = data.thumbnailUrl || THUMBNAIL_FALLBACK;

  const [views, viewLabel] = useMemo(
    () => [
      Intl.NumberFormat("en", { notation: "compact" }).format(data.viewCount),
      data.viewCount === 1 ? "view" : "views",
    ],
    [data.viewCount]
  );

  return (
    <Link
      prefetch
      href={socialPath(`/videos/${data.id}`)}
      className="group relative block aspect-[3/2] w-full overflow-hidden rounded-xl bg-muted active:scale-[0.98] transition-transform"
    >
      <Image
        src={poster}
        alt={data.title}
        fill
        // Two columns inside the max-w-md shell (about 170px each on a phone).
        sizes="(max-width: 448px) 50vw, 224px"
        quality={65}
        unoptimized={!isOptimizableImage(poster)}
        className="object-cover"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

      {data.kind === "short" && (
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">
          SHORTS
        </span>
      )}

      {data.duration > 0 && (
        <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {formatDuration(data.duration)}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-2">
        <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-white drop-shadow">
          {data.title}
        </h3>
        <p className="mt-0.5 truncate text-[11px] text-white/80">
          {data.user.name} · {views} {viewLabel}
        </p>
      </div>
    </Link>
  );
};

export const HomeVideoCardSkeleton = () => (
  <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl">
    <Skeleton className="size-full" />
  </div>
);
