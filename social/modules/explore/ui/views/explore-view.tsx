import Link from "next/link";

import { socialPath } from "@/social/constants";
import { SocialFeedHeader } from "@/social/components/social-feed-header";
import { SocialSearchInput } from "@/social/components/social-search-input";

import { SOCIAL_CATEGORIES } from "../../constants";
import { CategoryCard } from "../components/category-card";

/**
 * Where the feed's search icon lands: a search box over the category grid.
 * Submitting the box goes to the existing /search results page; a tile goes
 * to that category's feed.
 */
export const ExploreView = () => {
  return (
    <div className="min-h-lvh bg-white">
      <SocialFeedHeader
        title="Explore"
        showCategories={false}
        showBorder={false}
        titleSlot={
          <SocialSearchInput placeholder="Search for videos, creators, topics..." />
        }
      />
      <div className="grid grid-cols-2 gap-2.5 px-4 pt-20 pb-24">
        {SOCIAL_CATEGORIES.map((category) => (
          <Link
            key={category.slug}
            prefetch
            href={socialPath(`/category/${category.slug}`)}
            className="active:scale-[0.98] transition-transform"
          >
            <CategoryCard category={category} />
          </Link>
        ))}
      </div>
    </div>
  );
};
