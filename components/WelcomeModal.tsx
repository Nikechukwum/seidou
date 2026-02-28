import React, { useEffect, useRef, useState } from "react";
import { X, Play } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type WelcomeModalProps = {
  isOpen: boolean;
  onClose: (opts?: { permanentlyDisabled?: boolean }) => void;
  onStart?: () => void;
};

const LOCAL_DISABLE_KEY = "seidou_welcome_disabled";

export default function WelcomeModal({
  isOpen,
  onClose,
  onStart,
}: WelcomeModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // if user has checked don't show again, persist it
        if (dontShowAgain) localStorage.setItem(LOCAL_DISABLE_KEY, "true");
        onClose({ permanentlyDisabled: dontShowAgain });
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", onKey);
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      // focus the close button for keyboard users
      setTimeout(() => closeBtnRef.current?.focus(), 0);

      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen, dontShowAgain, onClose]);

  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      if (dontShowAgain) localStorage.setItem(LOCAL_DISABLE_KEY, "true");
      onClose({ permanentlyDisabled: dontShowAgain });
    }
  };

  const handleClose = () => {
    if (dontShowAgain) localStorage.setItem(LOCAL_DISABLE_KEY, "true");
    onClose({ permanentlyDisabled: dontShowAgain });
  };

  const handleStart = () => {
    if (dontShowAgain) localStorage.setItem(LOCAL_DISABLE_KEY, "true");
    onStart?.();
    onClose({ permanentlyDisabled: dontShowAgain });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onOverlayClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden={!isOpen}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal panel: narrower on phones with side gaps */}
          <motion.div
            id="seidou-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="seidou-title"
            tabIndex={-1}
            className="relative z-10 w-[90%] sm:w-87.5 md:w-100 mx-auto bg-white rounded-2xl shadow-2xl p-5 text-center"
            initial={{ y: 12, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, scale: 0.98, opacity: 0 }}
          >
            {/* X button (top-right inside the modal) */}
            <button
              ref={closeBtnRef}
              onClick={handleClose}
              aria-label="Close welcome dialog"
              className="absolute top-3 right-3 bg-zinc-900 text-white p-2 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400"
            >
              <X size={16} />
            </button>

            <h2 id="seidou-title" className="text-lg font-bold mb-1">
              Welcome to Seidou!
            </h2>
            <p className="text-sm text-zinc-600 mb-4">
              Here's a quick guide to get you started.
            </p>

            {/* video placeholder */}
            <div className="mx-auto mb-4 w-full max-w-xs">
              <div className="relative rounded-lg bg-zinc-100 aspect-video flex items-center justify-center">
                <button
                  onClick={handleStart}
                  aria-label="Play quick guide"
                  className="inline-flex items-center justify-center p-3 rounded-full bg-white/90 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400"
                >
                  <Play size={26} />
                </button>
              </div>
            </div>

            {/* Don't show again checkbox */}
            <label className="flex items-center gap-2 mb-3 cursor-pointer select-none justify-center">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 focus:ring-indigo-500"
              />
              <span className="text-sm text-zinc-700">
                Don&apos;t show this again
              </span>
            </label>

            {/* Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleStart}
                className="w-full rounded-lg py-3 text-sm font-medium bg-black text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                Start
              </button>

              <button
                onClick={handleClose}
                className="w-full rounded-lg border border-zinc-200 py-3 text-sm font-medium bg-zinc-50 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}