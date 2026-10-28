import { HydrateClient, trpc } from "@/social/trpc/server";
import { SHORTS_FEED_LIMIT } from "@/social/constants";
import { ShortsView } from "@/social/modules/shorts/ui/views/shorts-view";

export const dynamic = "force-dynamic";

const ShortsPage = async () => {
  void trpc.videos.getMany.prefetchInfinite({
    kind: "short",
    limit: SHORTS_FEED_LIMIT,
  });

  return (
    <HydrateClient>
      <ShortsView />
    </HydrateClient>
  );
};

export default ShortsPage;
