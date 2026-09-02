import { useEffect, useRef, useState } from "react";

interface UseIntersectionObserverOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number;
}

/**
 * Differs from the upstream version in one important way: it takes primitives
 * and depends on those, rather than taking an options OBJECT and depending on
 * it.
 *
 * Callers construct that object inline, so a fresh reference arrived on every
 * render, the effect re-ran, and the observer was torn down and rebuilt
 * constantly — resetting isIntersecting to false each time and sometimes
 * dropping the very callback that loads the next page.
 */
export const useIntersectionObserver = ({
  root = null,
  rootMargin = "0px",
  threshold = 0,
}: UseIntersectionObserverOptions = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = targetRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry.isIntersecting),
      { root, rootMargin, threshold }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [root, rootMargin, threshold]);

  return { targetRef, isIntersecting };
};
