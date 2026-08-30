import { redirect } from "next/navigation";

import { HydrateClient, trpc } from "@/social/trpc/server";
import { DEFAULT_LIMIT } from "@/social/constants";
import { StudioView } from "@/social/modules/studio/ui/views/studio-view";

export const dynamic = "force-dynamic";

const StudioPage = async () => {
  // studio.getMany is protected. A fire-and-forget prefetch that rejects with
  // UNAUTHORIZED aborts the streamed render and leaves a broken shell, so the
  // access check happens here instead.
  //
  // redirect() throws a control-flow signal, so it must sit outside the catch
  // or it would be swallowed.
  let authorized = true;
  try {
    await trpc.studio.getMany({ limit: DEFAULT_LIMIT });
  } catch {
    authorized = false;
  }

  if (!authorized) redirect("/signin");

  void trpc.studio.getMany.prefetchInfinite({ limit: DEFAULT_LIMIT });

  return (
    <HydrateClient>
      <StudioView />
    </HydrateClient>
  );
};

export default StudioPage;
