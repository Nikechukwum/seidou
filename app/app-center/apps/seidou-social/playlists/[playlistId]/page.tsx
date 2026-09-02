import { notFound, redirect } from "next/navigation";

import { HydrateClient, trpc } from "@/social/trpc/server";
import { DEFAULT_LIMIT } from "@/social/constants";
import { PlaylistVideosView } from "@/social/modules/playlists/ui/views/playlist-videos-view";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ playlistId: string }>;
}

const PlaylistPage = async ({ params }: PageProps) => {
  const { playlistId } = await params;

  // getOne is protected AND owner-scoped, so it throws UNAUTHORIZED when
  // signed out and NOT_FOUND for someone else's playlist.
  let outcome: "ok" | "unauthorized" | "missing" = "ok";
  try {
    await trpc.playlists.getOne({ id: playlistId });
  } catch (error) {
    outcome =
      (error as { code?: string })?.code === "UNAUTHORIZED"
        ? "unauthorized"
        : "missing";
  }

  if (outcome === "unauthorized") redirect("/signin");
  if (outcome === "missing") notFound();

  void trpc.playlists.getOne.prefetch({ id: playlistId });
  void trpc.playlists.getVideos.prefetchInfinite({
    playlistId,
    limit: DEFAULT_LIMIT,
  });

  return (
    <HydrateClient>
      <PlaylistVideosView playlistId={playlistId} />
    </HydrateClient>
  );
};

export default PlaylistPage;
