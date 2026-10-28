"use client";

import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

import { socialPath } from "@/social/constants";

/**
 * Floating top bar over the shorts player. There is no feed header here: the
 * video is edge to edge, so only the close control and title sit on top.
 */
export const ShortsTopBar = () => {
  const router = useRouter();

  return (
    <div className="pointer-events-none fixed left-1/2 top-0 z-20 flex w-full max-w-md -translate-x-1/2 items-center px-3 pt-3">
      <button
        type="button"
        onClick={() => router.push(socialPath())}
        aria-label="Close shorts"
        className="pointer-events-auto flex size-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
      >
        <ChevronLeftIcon className="size-5" />
      </button>
      <span className="ml-2 font-semibold text-white drop-shadow">Shorts</span>
    </div>
  );
};
