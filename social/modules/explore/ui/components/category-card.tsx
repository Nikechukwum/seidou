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
 * Until artwork exists (`category.image` unset) the gradient carries the tile
 * on its own.
 */
export const CategoryCard = ({
  category,
  selectable = false,
  selected = false,
}: CategoryCardProps) => {
  return (
    <div
      className={cn(
        "relative aspect-[2/1] w-full overflow-hidden rounded-lg transition-shadow",
        selected && "ring-2 ring-black ring-offset-2"
      )}
      style={{ background: category.gradient }}
    >
      {category.image && (
        <Image
          src={category.image}
          alt=""
          fill
          sizes="(max-width: 448px) 50vw, 224px"
          className="object-cover"
        />
      )}

      <span className="absolute left-2.5 top-2 max-w-[70%] text-[15px] font-semibold leading-tight text-white drop-shadow-sm">
        {category.name}
      </span>

      {selectable && (
        <span
          className={cn(
            "absolute right-2 top-2 flex size-5 items-center justify-center rounded-full border-2 border-white",
            selected && "bg-white"
          )}
        >
          {selected && <CheckIcon className="size-3 text-black" strokeWidth={3} />}
        </span>
      )}
    </div>
  );
};
