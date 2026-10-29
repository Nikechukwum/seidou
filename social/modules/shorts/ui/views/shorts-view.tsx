"use client";

import { useEffect, useState } from "react";

import { UnderConstructionModal } from "@/social/components/under-construction-modal";

import { ShortsTopBar } from "../components/shorts-top-bar";
import { ShortsFeedSection } from "../sections/shorts-feed-section";

/**
 * /shorts: a vertical, full-screen player. Seidou scrolls inside #main, so the
 * snap type is applied there while the page is open and restored on leave.
 */
export const ShortsView = () => {
  const [showComingSoon, setShowComingSoon] = useState(false);

  useEffect(() => {
    const main = document.querySelector("#main") as HTMLElement | null;
    if (!main) return;

    const previous = main.style.scrollSnapType;
    const previousScrollbar = main.style.scrollbarWidth;
    const hadNoScrollbar = main.classList.contains("no-scrollbar");
    main.style.scrollSnapType = "y mandatory";
    // The scrollbar shows as a white strip beside the black player
    main.style.scrollbarWidth = "none";
    main.classList.add("no-scrollbar");

    return () => {
      main.style.scrollSnapType = previous;
      main.style.scrollbarWidth = previousScrollbar;
      if (!hadNoScrollbar) main.classList.remove("no-scrollbar");
    };
  }, []);

  return (
    <div className="min-h-lvh bg-black">
      <ShortsTopBar />
      <ShortsFeedSection onAction={() => setShowComingSoon(true)} />

      <UnderConstructionModal
        isActive={showComingSoon}
        setIsActive={setShowComingSoon}
      />
    </div>
  );
};
