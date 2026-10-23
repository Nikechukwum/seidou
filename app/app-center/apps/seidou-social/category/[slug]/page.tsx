import { notFound } from "next/navigation";

import { HydrateClient, trpc } from "@/social/trpc/server";
import {
  CATEGORY_PAGE_SIZE,
  categoryVideosInput,
  parseCategoryTab,
} from "@/social/modules/explore/constants";
import { CategoryView } from "@/social/modules/explore/ui/views/category-view";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}

const CategoryPage = async ({ params, searchParams }: PageProps) => {
  const { slug } = await params;
  const tab = parseCategoryTab((await searchParams).tab);

  // Awaited, not prefetched: the feed queries need the category id, and an
  // unknown slug should be a real 404.
  const category = await trpc.explore.getCategory({ slug });
  if (!category) notFound();

  // Only the visible tab is prefetched; the others load when opened.
  if (category.id) {
    if (tab === "channels") {
      void trpc.explore.getChannels.prefetchInfinite({
        categoryId: category.id,
        limit: CATEGORY_PAGE_SIZE,
      });
    } else {
      void trpc.explore.getVideos.prefetchInfinite(
        categoryVideosInput(category.id, tab)
      );
    }
  }

  return (
    <HydrateClient>
      <CategoryView category={category} tab={tab} />
    </HydrateClient>
  );
};

export default CategoryPage;
