import { redirect } from "next/navigation";

import { HydrateClient, trpc } from "@/social/trpc/server";
import { DEFAULT_LIMIT } from "@/social/constants";
import { LikedView } from "@/social/modules/playlists/ui/views/liked-view";

export const dynamic = "force-dynamic";

const LikedPage = async () => {
  // Protected: a rejected fire-and-forget prefetch aborts the streamed render
  // and leaves a broken shell, so access is checked first. redirect() throws a
  // control-flow signal and must sit outside the catch.
  let authorized = true;
  try {
    await trpc.playlists.getLiked({ limit: DEFAULT_LIMIT });
  } catch {
    authorized = false;
  }

  if (!authorized) redirect("/signin");

  void trpc.playlists.getLiked.prefetchInfinite({ limit: DEFAULT_LIMIT });

  return (
    <HydrateClient>
      <LikedView />
    </HydrateClient>
  );
};

export default LikedPage;
