import { notFound } from "next/navigation";

import { HydrateClient, trpc } from "@/social/trpc/server";
import { DEFAULT_LIMIT } from "@/social/constants";
import { VideoView } from "@/social/modules/videos/ui/views/video-view";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ videoId: string }>;
}

const VideoPage = async ({ params }: PageProps) => {
  const { videoId } = await params;

  // Resolved before rendering rather than left to the client boundary.
  // getOne throws NOT_FOUND for a deleted or nonexistent video, and a
  // rejection during the streamed render aborts the whole shell — the page
  // came back blank apart from the nav. Failing here gives a real 404.
  try {
    await trpc.videos.getOne({ id: videoId });
  } catch {
    notFound();
  }

  // Now guaranteed to resolve, so these can stay fire-and-forget: the queries
  // start on the server and stream into the client cache.
  void trpc.videos.getOne.prefetch({ id: videoId });
  void trpc.suggestions.getMany.prefetchInfinite({
    videoId,
    limit: DEFAULT_LIMIT,
  });
  void trpc.comments.getMany.prefetchInfinite({ videoId, limit: DEFAULT_LIMIT });

  return (
    <HydrateClient>
      <VideoView videoId={videoId} />
    </HydrateClient>
  );
};

export default VideoPage;
