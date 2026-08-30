"use client";

import { ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { SearchIcon, UserRoundIcon } from "lucide-react";

import { trpc } from "@/social/trpc/client";
import { socialPath } from "@/social/constants";

interface SocialFeedHeaderProps {
  title: string;
  /**
   * Replaces the centered title and the trailing icons — used by the search
   * page, which needs its input in the top row rather than below it, so the
   * input stays put while the chips scroll away.
   */
  titleSlot?: ReactNode;
  /** Selected category, read from the URL by the page. */
  categoryId?: string;
  /** Trending and Subscribed have no category filter. */
  showCategories?: boolean;
  /**
   * Off on the feed, which is a destination rather than somewhere you
   * navigated into — Seidou's footer already gets you out of the app.
   */
  showBack?: boolean;
}

/**
 * Modelled on components/GamesHeader — same collapse-on-scroll behaviour, so
 * the two app-center apps feel the same.
 *
 * Differences: the chips come from the database rather than a fixed array, and
 * the selection lives in the URL so a filtered feed can be linked to and
 * survives a refresh.
 *
 * Only the chip row suspends, not the header itself — suspending the whole
 * header would take the title and back button down with it. Fetching the
 * chips with a plain useQuery instead would leave them out of the server HTML
 * entirely and pop them in after hydration, which flashes.
 */
export const SocialFeedHeader = ({
  title,
  titleSlot,
  categoryId,
  showCategories = true,
  showBack = false,
}: SocialFeedHeaderProps) => {
  const router = useRouter();
  const [fullHeader, setFullHeader] = useState(true);
  const lastScrollValue = useRef<number>(0);

  useEffect(() => {
    // Seidou scrolls inside #main, not the window.
    const mainElement = document.querySelector("#main") as HTMLElement | null;
    if (!mainElement) return;

    const checkScrollDirection = () => {
      const newScrollValue = mainElement.scrollTop;
      // Ignore small movements, otherwise the header jitters.
      if (Math.abs(newScrollValue - lastScrollValue.current) < 20) return;

      if (newScrollValue >= lastScrollValue.current && newScrollValue >= 100) {
        setFullHeader(false);
      } else {
        setFullHeader(true);
      }
      lastScrollValue.current = newScrollValue;
    };

    mainElement.addEventListener("scroll", checkScrollDirection);
    return () => mainElement.removeEventListener("scroll", checkScrollDirection);
  }, []);

  const onSelectCategory = (value: string | null) => {
    // Built from the current location so this keeps working on any feed that
    // uses the header, and preserves any other query params.
    const url = new URL(window.location.href);

    if (value) {
      url.searchParams.set("categoryId", value);
    } else {
      url.searchParams.delete("categoryId");
    }

    router.push(url.toString());
  };

  return (
    <header
      className={`duration-300 bg-white fixed max-w-md top-0 z-10 w-full border-b border-b-[#E6E6E6] ${
        !fullHeader && showCategories ? "-translate-y-14" : ""
      }`}
    >
      {/* Top row */}
      <div className="h-14 flex items-center px-3 pt-3">
        {showBack && (
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="p-2 text-black"
          >
            <ArrowLeftIcon className="size-5" strokeWidth={3} />
          </button>
        )}

        {titleSlot ? (
          <div className="min-w-0 flex-1 pr-2">{titleSlot}</div>
        ) : (
          <>
            <span
              className={
                showBack
                  ? "absolute left-1/2 -translate-x-1/2 font-semibold text-xl"
                  : "pl-2 font-semibold text-xl"
              }
            >
              {title}
            </span>

            <div className="ml-auto flex items-center gap-1">
              <Link
                prefetch
                href={socialPath("/search")}
                aria-label="Search"
                className="p-2"
              >
                <SearchIcon className="size-5" />
              </Link>
              <Link
                prefetch
                href={socialPath("/social-profile")}
                aria-label="Social profile"
                className="p-2"
              >
                <UserRoundIcon className="size-5" />
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Category row — the part that scrolls away */}
      {showCategories && (
        <div className="w-full flex items-center bg-white px-2">
          <div className="no-scrollbar py-2.5 w-full flex gap-x-1.5 overflow-x-scroll snap-x snap-mandatory">
            <ErrorBoundary fallback={null}>
              <Suspense fallback={<CategoryChipsSkeleton />}>
                <CategoryChips
                  categoryId={categoryId}
                  onSelect={onSelectCategory}
                />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      )}
    </header>
  );
};

const chipClass = (active: boolean) =>
  `shrink-0 rounded-full px-4 py-1.5 text-sm first:ml-1 last:mr-1 snap-start active:scale-[1.07] transition-transform ${
    active ? "bg-[#202020] text-white" : "bg-[#f5f5f5]"
  }`;

const CategoryChipsSkeleton = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <div
        key={i}
        className="h-8 w-24 shrink-0 animate-pulse rounded-full bg-[#f5f5f5] first:ml-1"
      />
    ))}
  </>
);

const CategoryChips = ({
  categoryId,
  onSelect,
}: {
  categoryId?: string;
  onSelect: (value: string | null) => void;
}) => {
  const [categories] = trpc.categories.getMany.useSuspenseQuery();

  return (
    <>
      <button onClick={() => onSelect(null)} className={chipClass(!categoryId)}>
        All
      </button>

      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onSelect(category.id)}
          className={chipClass(category.id === categoryId)}
        >
          {category.name}
        </button>
      ))}
    </>
  );
};
