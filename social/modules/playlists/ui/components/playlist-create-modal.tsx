"use client";

import { useState } from "react";

import { trpc } from "@/social/trpc/client";
import { toast } from "@/social/lib/toast";
import { ResponsiveModal } from "@/social/components/responsive-modal";

interface PlaylistCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PlaylistCreateModal = ({
  open,
  onOpenChange,
}: PlaylistCreateModalProps) => {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");

  const create = trpc.playlists.create.useMutation({
    onSuccess: () => {
      utils.playlists.getMany.invalidate();
      toast.success("Playlist created");
      setName("");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate({ name: name.trim() });
  };

  return (
    <ResponsiveModal
      title="New playlist"
      open={open}
      onOpenChange={onOpenChange}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-bold text-gray-700">
            Name
          </label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Watch later"
            autoFocus
            className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-black focus:ring-1 focus:ring-black"
          />
        </div>

        <button
          type="submit"
          disabled={create.isPending || !name.trim()}
          className="w-full rounded-full bg-black py-3.5 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {create.isPending ? "Creating…" : "Create"}
        </button>
      </form>
    </ResponsiveModal>
  );
};
