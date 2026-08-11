import Link from "next/link";
import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";

import { socialPath } from "@/social/constants";
import { Skeleton } from "@/social/components/ui/skeleton";
import { UserAvatar } from "@/social/components/user-avatar";
import { UserInfo } from "@/social/modules/users/ui/components/user-info";

import { VideoGetManyOutput } from "../../types";

interface VideoInfoProps {
  data: VideoGetManyOutput["items"][number];
  onRemove?: () => void;
}

export const VideoInfoSkeleton = () => {
  return (
    <div className="flex gap-3">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-5 w-[90%]" />
        <Skeleton className="h-5 w-[70%]" />
      </div>
    </div>
  );
};

export const VideoInfo = ({ data }: VideoInfoProps) => {
  const compactViews = useMemo(() => {
    return Intl.NumberFormat("en", { notation: "compact" }).format(
      data.viewCount
    );
  }, [data.viewCount]);

  const compactDate = useMemo(() => {
    return formatDistanceToNow(data.createdAt, { addSuffix: true });
  }, [data.createdAt]);

  return (
    <div className="flex gap-3">
      <Link prefetch href={socialPath(`/users/${data.user.id}`)}>
        <UserAvatar imageUrl={data.user.imageUrl} name={data.user.name} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link prefetch href={socialPath(`/videos/${data.id}`)}>
          <h3 className="font-medium line-clamp-2 text-base break-words">
            {data.title}
          </h3>
        </Link>
        <Link prefetch href={socialPath(`/users/${data.user.id}`)}>
          <UserInfo name={data.user.name} />
        </Link>
        <Link prefetch href={socialPath(`/videos/${data.id}`)}>
          <p className="text-sm text-gray-600 line-clamp-1">
            {compactViews} views • {compactDate}
          </p>
        </Link>
      </div>
      {/* VideoMenu (share / add to playlist / remove) lands with M4-M5 —
          it needs the watch route and the studio mutations to exist. */}
    </div>
  );
};
