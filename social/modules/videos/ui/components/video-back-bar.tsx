"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

/**
 * Back button for the watch page, which has no page header: the player sits
 * at the very top of the page and this bar is laid over it.
 *
 * The gradient keeps the white arrow readable on any video frame. The bar
 * itself ignores taps so the player underneath still receives them; only the
 * button is clickable. Its 10px padding puts the icon 10px from the top and
 * left edges while keeping a 40px tap target.
 */
export const VideoBackBar = () => {
  const router = useRouter();

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[50px]"
      style={{
        background:
          "linear-gradient(to bottom, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.3) 50%, rgba(0, 0, 0, 0) 100%)",
      }}
    >
      <button
        type="button"
        aria-label="Go back"
        onClick={() => router.back()}
        className="pointer-events-auto p-[10px] text-white"
      >
        <ArrowLeftIcon className="size-5" strokeWidth={3} />
      </button>
    </div>
  );
};
