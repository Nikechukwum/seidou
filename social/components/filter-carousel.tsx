"use client";

import { cn } from "@/social/lib/utils";
import { Skeleton } from "@/social/components/ui/skeleton";

interface FilterCarouselProps {
  value?: string | null;
  isLoading?: boolean;
  onSelect: (value: string | null) => void;
  data: { value: string; label: string }[];
}

/**
 * Replaces the upstream embla-carousel version with a plain scrolling row.
 *
 * Inside a max-w-md shell there is nothing for carousel arrows to do, and
 * touch scrolling is the expected interaction anyway. `.no-scrollbar` and
 * `.fade-right` are Seidou's existing utilities from app/globals.css, so the
 * chips match the filter row on the commerce home page.
 */
export const FilterCarousel = ({
  value,
  onSelect,
  data,
  isLoading,
}: FilterCarouselProps) => {
  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-hidden px-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar fade-right px-4">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "shrink-0 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap border transition-colors",
          !value
            ? "bg-[#202020] text-white border-[#202020]"
            : "bg-white text-gray-700 border-gray-200"
        )}
      >
        All
      </button>

      {data.map((item) => (
        <button
          key={item.value}
          onClick={() => onSelect(item.value)}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap border transition-colors",
            value === item.value
              ? "bg-[#202020] text-white border-[#202020]"
              : "bg-white text-gray-700 border-gray-200"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};
