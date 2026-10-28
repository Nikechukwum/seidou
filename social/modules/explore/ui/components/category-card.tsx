import Image from "next/image";
import { CheckIcon } from "lucide-react";

import { cn } from "@/social/lib/utils";

import type { SocialCategory } from "../../constants";

interface CategoryCardProps {
  category: SocialCategory;
  /** Onboarding shows a selection circle in the corner; Explore does not. */
  selectable?: boolean;
  selected?: boolean;
}

/**
 * One tile in the 2-column category grid — the Explore page and the interests
 * step of onboarding. Purely visual: the caller wraps it in a Link or button.
 *
 * The artwork is 16:9 with the category name lettered on, so the tile takes
 * that ratio and draws no label of its own. A category without artwork yet
 * falls back to its gradient plus a text label.
 */
export const CategoryCard = ({
  category,
  selectable = false,
  selected = false,
}: CategoryCardProps) => {
  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-lg transition-shadow",
        selected && "ring-2 ring-black ring-offset-2"
      )}
      style={{ background: category.gradient }}
    >
      {category.image ? (
        <Image
          src={category.image}
          // The name is part of the picture, so it is the alt text too.
          alt={category.name}
          fill
          sizes="(max-width: 448px) 50vw, 224px"
          quality={75}
          className="object-cover"
        />
      ) : (
        <span className="absolute left-2.5 top-2 max-w-[70%] text-[15px] font-semibold leading-tight text-white drop-shadow-sm">
          {category.name}
        </span>
      )}

      {selectable && (
        <span
          className={cn(
            // The dark fill keeps the white ring visible on bright artwork.
            "absolute right-2 top-2 flex size-5 items-center justify-center rounded-full border-2 border-white shadow-sm",
            selected ? "bg-white" : "bg-black/20"
          )}
        >
          {selected && <CheckIcon className="size-3 text-black" strokeWidth={3} />}
        </span>
      )}
    </div>
  );
};
