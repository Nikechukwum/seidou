import { notFound } from "next/navigation";

import { HydrateClient, trpc } from "@/social/trpc/server";
import { YouTubeVideoView } from "@/social/modules/youtube-videos/ui/views/youtube-video-view";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ youtubeId: string }>;
}

/** The watch page for an imported YouTube video — the feed links here. */
const YouTubeVideoPage = async ({ params }: PageProps) => {
  const { youtubeId } = await params;

  // Resolved first for a real 404, as on the upload watch page.
  try {
    await trpc.youtubeVideos.getOne({ youtubeId });
  } catch {
    notFound();
  }

  void trpc.youtubeVideos.getOne.prefetch({ youtubeId });
  void trpc.youtubeVideos.getMore.prefetch({ youtubeId, limit: 20 });

  return (
    <HydrateClient>
      <YouTubeVideoView youtubeId={youtubeId} />
    </HydrateClient>
  );
};

export default YouTubeVideoPage;
