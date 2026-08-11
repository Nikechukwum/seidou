"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { useIntersectionObserver } from "@/social/hooks/use-intersection-observer";

interface InfiniteScrollProps {
  isManual?: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

export const InfiniteScroll = ({
  isManual = false,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: InfiniteScrollProps) => {
  /**
   * Seidou scrolls inside #main (`max-w-md overflow-scroll h-screen` in the
   * root layout), not the window. With the default root, rootMargin is
   * measured against the viewport and does NOT extend through an ancestor
   * scroller's clip rect — so the upstream "100px" prefetch window was dead
   * and pages only loaded once the sentinel was already on screen.
   *
   * Resolved in an effect rather than during render because document is not
   * available server-side. First paint observes against the viewport, then
   * re-observes against #main — harmless, and it keeps this SSR-safe.
   */
  const [root, setRoot] = useState<Element | null>(null);

  useEffect(() => {
    setRoot(document.getElementById("main"));
  }, []);

  const { targetRef, isIntersecting } = useIntersectionObserver({
    root,
    rootMargin: "400px",
    threshold: 0,
  });

  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage && !isManual) {
      fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, isManual, fetchNextPage]);

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div ref={targetRef} className="h-1" />
      {hasNextPage ? (
        <Button
          text={isFetchingNextPage ? "Loading..." : "Load more"}
          bordered
          size="sm"
          onClick={() => fetchNextPage()}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          You have reached the end of the list
        </p>
      )}
    </div>
  );
};
