import { redirect } from "next/navigation";

import { HydrateClient, trpc } from "@/social/trpc/server";
import { DEFAULT_LIMIT } from "@/social/constants";
import { SubscribedView } from "@/social/modules/home/ui/views/subscribed-view";

export const dynamic = "force-dynamic";

const SubscribedPage = async () => {
  // getManySubscribed is protected. A rejected fire-and-forget prefetch aborts
  // the streamed render and leaves a broken shell, so check access first.
  // redirect() throws a control-flow signal and must sit outside the catch.
  let authorized = true;
  try {
    await trpc.videos.getManySubscribed({ limit: DEFAULT_LIMIT });
  } catch {
    authorized = false;
  }

  if (!authorized) redirect("/signin");

  void trpc.videos.getManySubscribed.prefetchInfinite({ limit: DEFAULT_LIMIT });

  return (
    <HydrateClient>
      <SubscribedView />
    </HydrateClient>
  );
};

export default SubscribedPage;
