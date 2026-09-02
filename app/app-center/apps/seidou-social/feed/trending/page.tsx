import { HydrateClient, trpc } from "@/social/trpc/server";
import { DEFAULT_LIMIT } from "@/social/constants";
import { TrendingView } from "@/social/modules/home/ui/views/trending-view";

export const dynamic = "force-dynamic";

const TrendingPage = async () => {
  void trpc.videos.getManyTrending.prefetchInfinite({ limit: DEFAULT_LIMIT });

  return (
    <HydrateClient>
      <TrendingView />
    </HydrateClient>
  );
};

export default TrendingPage;
