import { redirect } from "next/navigation";

import { HydrateClient, trpc } from "@/social/trpc/server";
import { DEFAULT_LIMIT } from "@/social/constants";
import { HistoryView } from "@/social/modules/playlists/ui/views/history-view";

export const dynamic = "force-dynamic";

const HistoryPage = async () => {
  // Protected: a rejected fire-and-forget prefetch aborts the streamed render
  // and leaves a broken shell, so access is checked first. redirect() throws a
  // control-flow signal and must sit outside the catch.
  let authorized = true;
  try {
    await trpc.playlists.getHistory({ limit: DEFAULT_LIMIT });
  } catch {
    authorized = false;
  }

  if (!authorized) redirect("/signin");

  void trpc.playlists.getHistory.prefetchInfinite({ limit: DEFAULT_LIMIT });

  return (
    <HydrateClient>
      <HistoryView />
    </HydrateClient>
  );
};

export default HistoryPage;
