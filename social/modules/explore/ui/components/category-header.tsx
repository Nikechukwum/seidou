"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

import { socialPath } from "@/social/constants";
import { cn } from "@/social/lib/utils";

import { CATEGORY_TABS, CategoryTab } from "../../constants";

const TAB_LABELS: Record<CategoryTab, string> = {
  all: "All",
  shorts: "Shorts",
  videos: "Videos",
  channels: "Channels",
};

interface CategoryHeaderProps {
  title: string;
  slug: string;
  tab: CategoryTab;
}

/**
 * Back button, centred title, and the tab chips. Same fixed max-w-md shell as
 * SocialFeedHeader, but it never collapses: the tabs are how you move around
 * this page, so they stay reachable mid-scroll.
 */
export const CategoryHeader = ({ title, slug, tab }: CategoryHeaderProps) => {
  const router = useRouter();

  return (
    <header className="bg-white fixed max-w-md top-0 z-10 w-full border-b border-b-[#E6E6E6]">
      <div className="relative h-14 flex items-center px-3 pt-3">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="p-2 text-black"
        >
          <ArrowLeftIcon className="size-5" strokeWidth={3} />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 max-w-[60%] truncate font-semibold text-xl">
          {title}
        </h1>
      </div>

      {/* justify-between spreads the four tabs across the row instead of
          bunching them left with a gap at the end; gap-x-3 is the minimum
          spacing, and below that (very narrow phones) the row scrolls. */}
      <nav className="no-scrollbar flex justify-between gap-x-3 overflow-x-auto px-4 py-3">
        {CATEGORY_TABS.map((value) => {
          const active = value === tab;
          const href =
            value === "all"
              ? socialPath(`/category/${slug}`)
              : socialPath(`/category/${slug}?tab=${value}`);

          return (
            <Link
              key={value}
              href={href}
              // Switching tabs is not a new page; back should leave the category.
              replace
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-md px-4 py-1.5 text-sm font-medium active:scale-[1.07] transition-transform",
                active ? "bg-[#202020] text-white" : "bg-[#f2f2f2] text-black"
              )}
            >
              {TAB_LABELS[value]}
            </Link>
          );
        })}
      </nav>
    </header>
  );
};
