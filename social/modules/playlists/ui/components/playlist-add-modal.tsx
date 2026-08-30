"use client";

import { CheckIcon, Loader2Icon, SquareIcon } from "lucide-react";

import { trpc } from "@/social/trpc/client";
import { toast } from "@/social/lib/toast";
import { DEFAULT_LIMIT } from "@/social/constants";
import { ResponsiveModal } from "@/social/components/responsive-modal";

interface PlaylistAddModalProps {
  videoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The "Save to playlist" sheet. getManyForVideo already returns a
 * containsVideo flag per playlist, so each row knows its own state without a
 * second query.
 */
export const PlaylistAddModal = ({
  videoId,
  open,
  onOpenChange,
}: PlaylistAddModalProps) => {
  const utils = trpc.useUtils();

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    trpc.playlists.getManyForVideo.useInfiniteQuery(
      { videoId, limit: DEFAULT_LIMIT },
      {
        enabled: open,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  const invalidate = () => {
    utils.playlists.getManyForVideo.invalidate({ videoId });
    utils.playlists.getMany.invalidate();
  };

  const addVideo = trpc.playlists.addVideo.useMutation({
    onSuccess: () => {
      toast.success("Saved to playlist");
      invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const removeVideo = trpc.playlists.removeVideo.useMutation({
    onSuccess: () => {
      toast.success("Removed from playlist");
      invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const pending = addVideo.isPending || removeVideo.isPending;
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <ResponsiveModal
      title="Save to playlist"
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="max-h-[50vh] space-y-1 overflow-y-auto">
        {isLoading && (
          <Loader2Icon className="mx-auto size-5 animate-spin text-muted-foreground" />
        )}

        {!isLoading && items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            You have no playlists yet.
          </p>
        )}

        {items.map((playlist) => (
          <button
            key={playlist.id}
            disabled={pending}
            onClick={() =>
              playlist.containsVideo
                ? removeVideo.mutate({ playlistId: playlist.id, videoId })
                : addVideo.mutate({ playlistId: playlist.id, videoId })
            }
            className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left disabled:opacity-50"
          >
            {playlist.containsVideo ? (
              <CheckIcon className="size-5 shrink-0" />
            ) : (
              <SquareIcon className="size-5 shrink-0 text-gray-300" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {playlist.name}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {playlist.videoCount}
            </span>
          </button>
        ))}

        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full py-2 text-xs font-semibold text-blue-600 disabled:opacity-50"
          >
            {isFetchingNextPage ? "Loading…" : "Show more"}
          </button>
        )}
      </div>
    </ResponsiveModal>
  );
};
