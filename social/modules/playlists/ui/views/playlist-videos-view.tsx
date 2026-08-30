import { PageLayout } from "@/components/PageLayout";

import { PlaylistVideosSection } from "../sections/playlist-videos-section";

interface PlaylistVideosViewProps {
  playlistId: string;
}

export const PlaylistVideosView = ({ playlistId }: PlaylistVideosViewProps) => (
  <PageLayout pageTitle="Playlist" className="bg-white">
    <PlaylistVideosSection playlistId={playlistId} />
  </PageLayout>
);
