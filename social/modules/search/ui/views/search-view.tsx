import { SocialFeedHeader } from "@/social/components/social-feed-header";
import { SocialSearchInput } from "@/social/components/social-search-input";

import { ResultsSection } from "../sections/results-section";

interface SearchViewProps {
  query?: string;
  categoryId?: string;
}

export const SearchView = ({ query, categoryId }: SearchViewProps) => {
  return (
    <div className="min-h-lvh bg-white">
      {/* The input takes the top row so it stays put while the category chips
          collapse away on scroll. */}
      <SocialFeedHeader
        title="Search"
        categoryId={categoryId}
        showBack
        titleSlot={
          <SocialSearchInput
            defaultQuery={query}
            defaultCategoryId={categoryId}
          />
        }
      />
      <div className="pt-28 pb-20">
        <ResultsSection query={query} categoryId={categoryId} />
      </div>
    </div>
  );
};
