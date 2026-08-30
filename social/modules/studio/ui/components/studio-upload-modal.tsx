"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";

import { trpc } from "@/social/trpc/client";
import { toast } from "@/social/lib/toast";
import { socialPath } from "@/social/constants";
import { ResponsiveModal } from "@/social/components/responsive-modal";

import { StudioUploader } from "./studio-uploader";

export const StudioUploadModal = () => {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const createdVideoId = useRef<string | null>(null);

  const create = trpc.videos.create.useMutation();

  /**
   * Deliberately NOT called when the dialog opens.
   *
   * videos.create both reserves a Mux upload and inserts a row, so calling it
   * on open meant every tap of "Upload" left behind an empty "Untitled ·
   * Waiting" video, whether or not a file was ever chosen. The uploader
   * accepts an endpoint FUNCTION and invokes it only once the user has picked
   * a file, so the row is now created at the moment an upload genuinely
   * starts.
   */
  const getUploadUrl = async () => {
    const result = await create.mutateAsync();
    createdVideoId.current = result.video.id;
    return result.url;
  };

  const onSuccess = () => {
    setOpen(false);
    utils.studio.getMany.invalidate();

    const id = createdVideoId.current;
    createdVideoId.current = null;

    if (id) router.push(socialPath(`/studio/videos/${id}`));
  };

  return (
    <>
      <ResponsiveModal
        title="Upload a video"
        open={open}
        onOpenChange={setOpen}
      >
        <StudioUploader
          endpoint={async () => {
            try {
              return await getUploadUrl();
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Could not start upload"
              );
              throw error;
            }
          }}
          onSuccess={onSuccess}
        />
      </ResponsiveModal>

      <button
        onClick={() => setOpen(true)}
        aria-label="Upload a video"
        className="flex items-center gap-1 text-sm font-semibold"
      >
        <PlusIcon className="size-5" />
        Upload
      </button>
    </>
  );
};
