import { SOCIAL_CATEGORIES } from "@/social/modules/explore/constants";
import { CategoryCard } from "@/social/modules/explore/ui/components/category-card";

import { MIN_INTERESTS } from "../../constants";
import { ContinueBar } from "./continue-bar";

interface InterestsStepProps {
  selected: string[];
  onChange: (slugs: string[]) => void;
  onContinue: () => void;
}

export const InterestsStep = ({
  selected,
  onChange,
  onContinue,
}: InterestsStepProps) => {
  const toggle = (slug: string) =>
    onChange(
      selected.includes(slug)
        ? selected.filter((s) => s !== slug)
        : [...selected, slug]
    );

  const remaining = MIN_INTERESTS - selected.length;

  return (
    <div className="flex flex-col px-4 pt-4 pb-28">
      <div className="px-2">
        <h1 className="text-2xl font-bold tracking-tight text-black">
          Select your interests
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Choose {MIN_INTERESTS} or more categories to personalize your feed.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2.5">
        {SOCIAL_CATEGORIES.map((category) => {
          const isSelected = selected.includes(category.slug);
          return (
            <button
              key={category.slug}
              type="button"
              onClick={() => toggle(category.slug)}
              aria-pressed={isSelected}
              className="text-left active:scale-[0.98] transition-transform"
            >
              <CategoryCard category={category} selectable selected={isSelected} />
            </button>
          );
        })}
      </div>

      <ContinueBar
        disabled={remaining > 0}
        onClick={onContinue}
        label={remaining > 0 ? `Select ${remaining} more` : "Continue"}
      />
    </div>
  );
};
