import { CategoryTab } from "../../constants";
import { CategoryHeader } from "../components/category-header";
import { CategoryVideosSection } from "../sections/category-videos-section";
import { CategoryShortsSection } from "../sections/category-shorts-section";
import { CategoryChannelsSection } from "../sections/category-channels-section";

interface CategoryViewProps {
  category: { slug: string; name: string; id: string | null };
  tab: CategoryTab;
}

/**
 * /category/[slug]: every public video filed under one category, newest first,
 * split into All / Shorts / Videos / Channels tabs. The tab lives in the URL
 * (?tab=) so it survives a refresh and the back button.
 */
export const CategoryView = ({ category, tab }: CategoryViewProps) => {
  return (
    <div className="min-h-lvh bg-white">
      <CategoryHeader title={category.name} slug={category.slug} tab={tab} />
      <div className="pt-28 pb-20">
        {!category.id ? (
          // In the Explore grid but not seeded yet — see seed-categories.ts.
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            No videos here yet.
          </p>
        ) : tab === "channels" ? (
          <CategoryChannelsSection categoryId={category.id} />
        ) : tab === "shorts" ? (
          <CategoryShortsSection categoryId={category.id} />
        ) : (
          <CategoryVideosSection categoryId={category.id} tab={tab} />
        )}
      </div>
    </div>
  );
};
