"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { cn } from "@/social/lib/utils";

interface VideoDescriptionProps {
  compactViews: string;
  expandedViews: string;
  description?: string | null;
}

export const VideoDescription = ({
  compactViews,
  expandedViews,
  description,
}: VideoDescriptionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      onClick={() => setIsExpanded((current) => !current)}
      className="bg-secondary/50 rounded-xl p-3 cursor-pointer transition"
    >
      <div className="flex gap-2 text-sm mb-2">
        {/* Only Seidou's own view count is shown. Imported videos no longer
            leak the source's view count or upload date. */}
        <span className="font-medium">
          {isExpanded ? expandedViews : compactViews} views
        </span>
      </div>
      <div className="relative">
        <p
          className={cn(
            "text-sm whitespace-pre-wrap",
            !isExpanded && "line-clamp-2"
          )}
        >
          {description || "No description"}
        </p>
        <div className="flex items-center gap-1 mt-4 text-sm font-medium">
          {isExpanded ? (
            <>
              Show less <ChevronUpIcon className="size-4" />
            </>
          ) : (
            <>
              Show more <ChevronDownIcon className="size-4" />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
