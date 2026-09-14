import { VideoBackBar } from "../components/video-back-bar";
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
 *
 * No PageLayout header: the player runs edge to edge at the very top of the
 * page with VideoBackBar laid over it. Only the player spans the full width;
 * everything below keeps the usual 16px side padding.
 */
export const VideoView = ({ videoId }: VideoViewProps) => {
  return (
    <div className="relative min-h-lvh bg-white pb-20">
      <VideoBackBar />
      <div className="flex flex-col gap-8">
        <VideoSection videoId={videoId} />
        <div className="flex flex-col gap-8 px-4">
          <CommentsSection videoId={videoId} />
          <SuggestionsSection videoId={videoId} />
        </div>
      </div>
    </div>
  );
};
