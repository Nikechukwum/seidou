import { redirect } from "next/navigation";

import { HydrateClient, trpc } from "@/social/trpc/server";
import { DEFAULT_LIMIT } from "@/social/constants";
import { PlaylistsView } from "@/social/modules/playlists/ui/views/playlists-view";

export const dynamic = "force-dynamic";

const PlaylistsPage = async () => {
  // Protected: a rejected fire-and-forget prefetch aborts the streamed render
  // and leaves a broken shell, so access is checked first. redirect() throws a
  // control-flow signal and must sit outside the catch.
  let authorized = true;
  try {
    await trpc.playlists.getMany({ limit: DEFAULT_LIMIT });
  } catch {
    authorized = false;
  }

  if (!authorized) redirect("/signin");

  void trpc.playlists.getMany.prefetchInfinite({ limit: DEFAULT_LIMIT });

  return (
    <HydrateClient>
      <PlaylistsView />
    </HydrateClient>
  );
};

export default PlaylistsPage;
