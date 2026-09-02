import { HydrateClient, trpc } from "@/social/trpc/server";
import { DEFAULT_LIMIT } from "@/social/constants";
import { HomeView } from "@/social/modules/home/ui/views/home-view";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ categoryId?: string }>;
}

const SeidouSocialPage = async ({ searchParams }: PageProps) => {
  const { categoryId } = await searchParams;

  // Fire-and-forget, deliberately not awaited: the queries start on the server
  // and stream in, while the client components below suspend on the same keys.
  // makeQueryClient dehydrates pending queries, which is what makes this work.
  void trpc.categories.getMany.prefetch();
  void trpc.videos.getMany.prefetchInfinite({
    categoryId,
    limit: DEFAULT_LIMIT,
  });

  return (
    <HydrateClient>
      <HomeView categoryId={categoryId} />
    </HydrateClient>
  );
};

export default SeidouSocialPage;
