import { PageLayout } from "@/components/PageLayout";

import { VideoSection } from "../sections/video-section";
import { CommentsSection } from "../sections/comments-section";
import { SuggestionsSection } from "../sections/suggestions-section";

interface VideoViewProps {
  videoId: string;
}

/**
 * Single column, unlike the upstream two-column watch layout — inside a
 * max-w-md shell there is no room for a suggestions rail, so it stacks below
 * the player instead.
 */
export const VideoView = ({ videoId }: VideoViewProps) => {
  return (
    <PageLayout pageTitle="" className="bg-white px-4">
      <div className="flex flex-col gap-8">
        <VideoSection videoId={videoId} />
        <SuggestionsSection videoId={videoId} />
        <CommentsSection videoId={videoId} />
      </div>
    </PageLayout>
  );
};
