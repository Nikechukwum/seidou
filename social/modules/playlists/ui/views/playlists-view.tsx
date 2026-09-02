"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

import { PageLayout } from "@/components/PageLayout";

import { PlaylistsSection } from "../sections/playlists-section";
import { PlaylistCreateModal } from "../components/playlist-create-modal";

export const PlaylistsView = () => {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <PageLayout
      pageTitle="Playlists"
      className="bg-white"
      extraButton={
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1 text-sm font-semibold"
        >
          <PlusIcon className="size-5" />
          New
        </button>
      }
    >
      <PlaylistCreateModal open={createOpen} onOpenChange={setCreateOpen} />
      <PlaylistsSection />
    </PageLayout>
  );
};
