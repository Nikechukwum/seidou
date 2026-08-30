import Image from "next/image";

import { formatDuration } from "@/social/lib/utils";
import { Skeleton } from "@/social/components/ui/skeleton";

import { THUMBNAIL_FALLBACK } from "../../constants";

interface VideoThumbnailProps {
  title: string;
  duration: number;
  imageUrl?: string | null;
  previewUrl?: string | null;
}

export const VideoThumbnailSkeleton = () => {
  return (
    <div className="relative w-full overflow-hidden rounded-xl aspect-video">
      <Skeleton className="size-full" />
    </div>
  );
};

export const VideoThumbnail = ({
  title,
  imageUrl,
  previewUrl,
  duration,
}: VideoThumbnailProps) => {
  return (
    <div className="relative group">
      <div className="relative w-full overflow-hidden rounded-xl aspect-video bg-muted">
        <Image
          src={imageUrl || THUMBNAIL_FALLBACK}
          alt={title}
          fill
          // One column inside a max-w-md shell, so never wider than 448px.
          sizes="(max-width: 448px) 100vw, 448px"
          quality={65}
          className="h-full w-full object-cover group-hover:opacity-0"
        />
        {/* Animated preview. unoptimized because it is a GIF — Next's
            optimizer would strip the animation and serve a still frame. */}
        <Image
          unoptimized={!!previewUrl}
          src={previewUrl || THUMBNAIL_FALLBACK}
          alt={title}
          fill
          className="h-full w-full object-cover opacity-0 group-hover:opacity-100"
        />
      </div>

      <div className="absolute bottom-2 right-2 px-1 py-0.5 rounded bg-black/80 text-white text-xs font-medium">
        {formatDuration(duration)}
      </div>
    </div>
  );
};
