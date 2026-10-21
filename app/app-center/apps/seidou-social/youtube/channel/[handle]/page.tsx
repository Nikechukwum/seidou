import { notFound } from "next/navigation";

import { HydrateClient, trpc } from "@/social/trpc/server";
import { YouTubeChannelView } from "@/social/modules/youtube-videos/ui/views/youtube-channel-view";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ handle: string }>;
}

/** An imported YouTube channel: /youtube/channel/zeltik. */
const YouTubeChannelPage = async ({ params }: PageProps) => {
  const handle = decodeURIComponent((await params).handle);

  // Resolved first for a real 404, as on the user channel page.
  try {
    await trpc.youtubeVideos.getChannel({ handle });
  } catch {
    notFound();
  }

  void trpc.youtubeVideos.getChannel.prefetch({ handle });

  return (
    <HydrateClient>
      <YouTubeChannelView handle={handle} />
    </HydrateClient>
  );
};

export default YouTubeChannelPage;
