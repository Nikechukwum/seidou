"use client";

import { useEffect } from "react";
import { XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { youtubeEmbedUrl } from "../../lib/parse";

interface YouTubePlayerOverlayProps {
  videoId: string;
  title: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Full-screen overlay that plays one YouTube video in the middle of the page.
 *
 * Not built on components/Modal: that wraps its children in a white padded
 * card and sets touch-none, which would box the player in. The fade matches
 * it so the two feel the same.
 *
 * The iframe exists only while the overlay is open. Closing unmounts it,
 * which is also what stops playback — and it means a list of these costs
 * nothing until one is tapped.
 */
export const YouTubePlayerOverlay = ({
  videoId,
  title,
  open,
  onClose,
}: YouTubePlayerOverlayProps) => {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.3 } }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 p-4"
        >
          <div
            // Taps on the player itself must not close the overlay.
            onClick={(event) => event.stopPropagation()}
            className="relative w-full max-w-3xl"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close video"
              className="absolute -top-11 right-0 flex size-9 items-center justify-center rounded-full bg-black text-white"
            >
              <XIcon className="size-5" />
            </button>

            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lg">
              <iframe
                src={youtubeEmbedUrl(videoId)}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                // YouTube refuses to play an embed that sends no referrer.
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="size-full border-0"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
