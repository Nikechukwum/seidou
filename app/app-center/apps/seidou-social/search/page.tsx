import { HydrateClient, trpc } from "@/social/trpc/server";
import { DEFAULT_LIMIT } from "@/social/constants";
import { SearchView } from "@/social/modules/search/ui/views/search-view";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ query?: string; categoryId?: string }>;
}

const SearchPage = async ({ searchParams }: PageProps) => {
  const { query, categoryId } = await searchParams;

  void trpc.categories.getMany.prefetch();
  void trpc.search.getMany.prefetchInfinite({
    query,
    categoryId,
    limit: DEFAULT_LIMIT,
  });

  return (
    <HydrateClient>
      <SearchView query={query} categoryId={categoryId} />
    </HydrateClient>
  );
};

export default SearchPage;
