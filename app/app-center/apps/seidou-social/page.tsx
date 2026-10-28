import { redirect } from "next/navigation";

import { HydrateClient, trpc } from "@/social/trpc/server";
import { HOME_FEED_LIMIT, socialPath } from "@/social/constants";
import { HomeView } from "@/social/modules/home/ui/views/home-view";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ categoryId?: string }>;
}

const SeidouSocialPage = async ({ searchParams }: PageProps) => {
  const { categoryId } = await searchParams;

  // The App Center's "Open" lands here, so this is where a signed-in user who
  // has not finished Seidou Social onboarding gets sent through it first.
  const { required } = await trpc.socialProfiles.getOnboardingStatus();
  if (required) redirect(socialPath("/onboarding"));

  // Fire-and-forget, deliberately not awaited: the queries start on the server
  // and stream in, while the client components below suspend on the same keys.
  // makeQueryClient dehydrates pending queries, which is what makes this work.
  void trpc.categories.getMany.prefetch();
  void trpc.videos.getMany.prefetchInfinite({
    categoryId,
    kind: "video",
    limit: HOME_FEED_LIMIT,
  });

  return (
    <HydrateClient>
      <HomeView categoryId={categoryId} />
    </HydrateClient>
  );
};

export default SeidouSocialPage;
