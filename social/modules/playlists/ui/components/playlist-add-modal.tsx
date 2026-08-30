"use client";

import { useEffect, useState } from "react";
import { CheckIcon, Loader2Icon, PlusIcon, SquareIcon } from "lucide-react";

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
 *
 * Creating happens inline rather than in a second modal: DrawerModal renders
 * a fixed overlay, so stacking two would leave them fighting over the screen.
 */
export const PlaylistAddModal = ({
  videoId,
  open,
  onOpenChange,
}: PlaylistAddModalProps) => {
  const utils = trpc.useUtils();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    trpc.playlists.getManyForVideo.useInfiniteQuery(
      { videoId, limit: DEFAULT_LIMIT },
      {
        enabled: open,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  // Reopening should always start on the list, never mid-create.
  useEffect(() => {
    if (!open) {
      setIsCreating(false);
      setName("");
    }
  }, [open]);

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

  const createPlaylist = trpc.playlists.create.useMutation({
    onSuccess: async (playlist) => {
      // Creating from here means you wanted the video in it — saving it
      // straight away avoids making you tap the row you just made.
      await addVideo.mutateAsync({ playlistId: playlist.id, videoId });
      setIsCreating(false);
      setName("");
      invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const pending =
    addVideo.isPending || removeVideo.isPending || createPlaylist.isPending;

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    createPlaylist.mutate({ name: name.trim() });
  };

  return (
    <ResponsiveModal
      title={isCreating ? "New playlist" : "Save to playlist"}
      open={open}
      onOpenChange={onOpenChange}
    >
      {isCreating ? (
        <form onSubmit={handleCreate} className="space-y-4">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Watch later"
            maxLength={120}
            autoFocus
            className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-black focus:ring-1 focus:ring-black"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="flex-1 rounded-full border border-gray-200 py-3 text-sm font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPlaylist.isPending || !name.trim()}
              className="flex-1 rounded-full bg-black py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              {createPlaylist.isPending ? "Creating…" : "Create & save"}
            </button>
          </div>
        </form>
      ) : (
        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {isLoading && (
            <Loader2Icon className="mx-auto size-5 animate-spin text-muted-foreground" />
          )}

          {!isLoading && items.length === 0 && (
            <p className="pb-2 pt-1 text-center text-sm text-muted-foreground">
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

          {/* Always available, not only when the list is empty — wanting a new
              playlist is not conditional on having none. */}
          {!isLoading && (
            <button
              onClick={() => setIsCreating(true)}
              className="mt-1 flex w-full items-center gap-3 rounded-xl border-t border-gray-100 px-2 pb-1 pt-4 text-left text-sm font-semibold"
            >
              <PlusIcon className="size-5 shrink-0" />
              New playlist
            </button>
          )}
        </div>
      )}
    </ResponsiveModal>
  );
};
