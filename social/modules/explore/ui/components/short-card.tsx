import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";

import { socialPath } from "@/social/constants";
import { isOptimizableImage } from "@/social/lib/image";
import { Skeleton } from "@/social/components/ui/skeleton";
import { UserAvatar } from "@/social/components/user-avatar";
import { THUMBNAIL_FALLBACK } from "@/social/modules/videos/constants";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/social/trpc/routers/_app";

type ShortItem =
  inferRouterOutputs<AppRouter>["explore"]["getVideos"]["items"][number];

export const ShortCardSkeleton = () => (
  <Skeleton className="aspect-[3/4] w-full rounded-xl" />
);

/**
 * A tile in the Shorts tab's 2-column grid: portrait thumbnail with the title,
 * channel and stats laid over a bottom scrim.
 */
export const ShortCard = ({ data }: { data: ShortItem }) => {
  const src = data.thumbnailUrl || THUMBNAIL_FALLBACK;

  const stats = useMemo(() => {
    const views = Intl.NumberFormat("en", { notation: "compact" }).format(
      data.viewCount
    );
    return `${views} views`;
  }, [data.viewCount]);

  return (
    <Link
      prefetch
      href={socialPath(`/videos/${data.id}`)}
      className="relative block aspect-[3/4] w-full overflow-hidden rounded-xl bg-[#202020]"
    >
      <Image
        src={src}
        alt={data.title}
        fill
        sizes="(max-width: 448px) 50vw, 224px"
        quality={65}
        unoptimized={!isOptimizableImage(src)}
        className="object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2.5 pb-2.5 pt-10 text-white">
        <h3 className="text-sm font-semibold leading-snug line-clamp-2 break-words">
          {data.title}
        </h3>
        <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
          <UserAvatar
            size="sm"
            imageUrl={data.user.imageUrl}
            name={data.user.name}
          />
          <span className="text-xs font-medium truncate">{data.user.name}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-white/75 truncate">{stats}</p>
      </div>
    </Link>
  );
};
