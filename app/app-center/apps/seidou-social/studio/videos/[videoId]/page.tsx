import { notFound, redirect } from "next/navigation";

import { HydrateClient, trpc } from "@/social/trpc/server";
import { VideoView } from "@/social/modules/studio/ui/views/video-view";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ videoId: string }>;
}

const StudioVideoPage = async ({ params }: PageProps) => {
  const { videoId } = await params;

  // studio.getOne is protected AND scoped to the owner, so it throws
  // UNAUTHORIZED when signed out and NOT_FOUND for someone else's video.
  // Both are resolved here — a rejected fire-and-forget prefetch would abort
  // the streamed render and leave a broken shell.
  let outcome: "ok" | "unauthorized" | "missing" = "ok";
  try {
    await trpc.studio.getOne({ id: videoId });
  } catch (error) {
    outcome =
      (error as { code?: string })?.code === "UNAUTHORIZED"
        ? "unauthorized"
        : "missing";
  }

  // Both throw control-flow signals, so they sit outside the catch.
  if (outcome === "unauthorized") redirect("/signin");
  if (outcome === "missing") notFound();

  void trpc.studio.getOne.prefetch({ id: videoId });
  void trpc.categories.getMany.prefetch();

  return (
    <HydrateClient>
      <VideoView videoId={videoId} />
    </HydrateClient>
  );
};

export default StudioVideoPage;
