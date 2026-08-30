"use client";

import { Suspense } from "react";
import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/social/trpc/client";
import { toast } from "@/social/lib/toast";
import { DEFAULT_LIMIT, socialPath } from "@/social/constants";
import { InfiniteScroll } from "@/social/components/infinite-scroll";
import {
  VideoGridCard,
  VideoGridCardSkeleton,
} from "@/social/modules/videos/ui/components/video-grid-card";

interface PlaylistVideosSectionProps {
  playlistId: string;
}

export const PlaylistVideosSection = ({
  playlistId,
}: PlaylistVideosSectionProps) => {
  return (
    <ErrorBoundary
      fallback={
        <p className="px-4 py-8 text-sm text-muted-foreground">
          Could not load this playlist.
        </p>
      }
    >
      <Suspense fallback={<Skeleton />}>
        <PlaylistVideosSectionSuspense playlistId={playlistId} />
      </Suspense>
    </ErrorBoundary>
  );
};

const Skeleton = () => (
  <div className="flex flex-col gap-6 px-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <VideoGridCardSkeleton key={i} />
    ))}
  </div>
);

const PlaylistVideosSectionSuspense = ({
  playlistId,
}: PlaylistVideosSectionProps) => {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [playlist] = trpc.playlists.getOne.useSuspenseQuery({ id: playlistId });
  const [videos, query] = trpc.playlists.getVideos.useSuspenseInfiniteQuery(
    { playlistId, limit: DEFAULT_LIMIT },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const removeVideo = trpc.playlists.removeVideo.useMutation({
    onSuccess: () => {
      toast.success("Removed from playlist");
      utils.playlists.getVideos.invalidate({ playlistId });
      utils.playlists.getMany.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const removePlaylist = trpc.playlists.remove.useMutation({
    onSuccess: () => {
      toast.success("Playlist deleted");
      utils.playlists.getMany.invalidate();
      router.push(socialPath("/playlists"));
    },
    onError: (error) => toast.error(error.message),
  });

  const items = videos.pages.flatMap((page) => page.items);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3 px-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{playlist.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? "video" : "videos"}
          </p>
        </div>
        <button
          onClick={() => removePlaylist.mutate({ id: playlistId })}
          disabled={removePlaylist.isPending}
          aria-label="Delete playlist"
          className="shrink-0 rounded-full border border-gray-200 p-2.5 disabled:opacity-50"
        >
          <TrashIcon className="size-4 text-red-600" />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">
          This playlist is empty. Use &ldquo;Save&rdquo; on a video to add one.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-6 px-4">
            {items.map((video) => (
              <VideoGridCard
                key={video.id}
                data={video}
                onRemove={() =>
                  removeVideo.mutate({ playlistId, videoId: video.id })
                }
              />
            ))}
          </div>
          <InfiniteScroll
            hasNextPage={query.hasNextPage}
            isFetchingNextPage={query.isFetchingNextPage}
            fetchNextPage={query.fetchNextPage}
          />
        </>
      )}
    </div>
  );
};
