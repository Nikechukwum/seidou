import { PageLayout } from "@/components/PageLayout";
import { SocialSearchInput } from "@/social/components/social-search-input";
import { CategoriesSection } from "@/social/modules/home/ui/sections/categories-section";

import { ResultsSection } from "../sections/results-section";

interface SearchViewProps {
  query?: string;
  categoryId?: string;
}

export const SearchView = ({ query, categoryId }: SearchViewProps) => {
  return (
    <PageLayout pageTitle="Search" className="bg-white">
      <div className="flex flex-col gap-6">
        <SocialSearchInput defaultQuery={query} defaultCategoryId={categoryId} />
        <CategoriesSection categoryId={categoryId} />
        <ResultsSection query={query} categoryId={categoryId} />
      </div>
    </PageLayout>
  );
};
