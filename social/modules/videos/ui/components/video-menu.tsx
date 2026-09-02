"use client";

import { useState } from "react";
import { ListPlusIcon, MoreVerticalIcon, Share2Icon, Trash2Icon } from "lucide-react";

import { toast } from "@/social/lib/toast";
import { socialUrl } from "@/social/constants";
import { useViewer } from "@/social/hooks/use-viewer";
import { ResponsiveModal } from "@/social/components/responsive-modal";
import { PlaylistAddModal } from "@/social/modules/playlists/ui/components/playlist-add-modal";

interface VideoMenuProps {
  videoId: string;
  /** Supplied by the playlist page, where the menu can also remove the video. */
  onRemove?: () => void;
}

/**
 * Replaces the upstream Radix DropdownMenu with a bottom sheet. A dropdown
 * anchored to a small icon is awkward on touch, and this reuses the drawer
 * every other modal here already uses.
 */
export const VideoMenu = ({ videoId, onRemove }: VideoMenuProps) => {
  const { isSignedIn, requireSignIn } = useViewer();
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const onShare = async () => {
    const url = socialUrl(`/videos/${videoId}`);

    // Web Share where available (that is the native sheet on a phone),
    // clipboard otherwise.
    if (navigator.share) {
      try {
        await navigator.share({ url });
        setMenuOpen(false);
        return;
      } catch {
        // Cancelled, or unavailable — fall through to copying.
      }
    }

    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
    setMenuOpen(false);
  };

  const onSave = () => {
    if (!isSignedIn) {
      requireSignIn();
      return;
    }
    setMenuOpen(false);
    setAddOpen(true);
  };

  return (
    <>
      <button
        onClick={(event) => {
          // The whole card is a link; the menu must not navigate.
          event.preventDefault();
          event.stopPropagation();
          setMenuOpen(true);
        }}
        aria-label="Video options"
        className="shrink-0 rounded-full p-2"
      >
        <MoreVerticalIcon className="size-4" />
      </button>

      <ResponsiveModal
        title="Video options"
        open={menuOpen}
        onOpenChange={setMenuOpen}
      >
        <div className="space-y-1">
          <button
            onClick={onShare}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left text-sm font-medium"
          >
            <Share2Icon className="size-5" />
            Share
          </button>

          <button
            onClick={onSave}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left text-sm font-medium"
          >
            <ListPlusIcon className="size-5" />
            Save to playlist
          </button>

          {onRemove && (
            <button
              onClick={() => {
                setMenuOpen(false);
                onRemove();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left text-sm font-medium text-red-600"
            >
              <Trash2Icon className="size-5" />
              Remove from playlist
            </button>
          )}
        </div>
      </ResponsiveModal>

      <PlaylistAddModal
        videoId={videoId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
    </>
  );
};
