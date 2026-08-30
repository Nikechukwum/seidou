"use client";

import Image from "next/image";
import { PlusIcon, XIcon } from "lucide-react";

import { trpc } from "@/social/trpc/client";
import { toast } from "@/social/lib/toast";
import { useViewer } from "@/social/hooks/use-viewer";
import { bannerPath, deleteSocialImage } from "@/social/lib/storage";
import { ImageUploadButton } from "@/social/components/image-upload-button";

import { UserGetOneOutput } from "../../types";

interface UserPageBannerProps {
  user: UserGetOneOutput;
}

/**
 * The empty state IS the affordance — the strip itself reads "+ Add banner"
 * and is the upload trigger, rather than a placeholder sitting above a
 * separate button. Visitors see nothing at all when there is no banner.
 */
export const UserPageBanner = ({ user }: UserPageBannerProps) => {
  const utils = trpc.useUtils();
  const { viewerId } = useViewer();

  const isOwner = viewerId === user.id;

  const updateBanner = trpc.users.updateBanner.useMutation({
    onSuccess: () => {
      utils.users.getOne.invalidate({ id: user.id });
      toast.success("Banner updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const removeBanner = trpc.users.removeBanner.useMutation({
    onSuccess: () => {
      utils.users.getOne.invalidate({ id: user.id });
      toast.success("Banner removed");
    },
    onError: (error) => toast.error(error.message),
  });

  const onRemove = async () => {
    // Deletion needs the user session the storage policies check, which only
    // exists in the browser.
    if (user.bannerKey) await deleteSocialImage(user.bannerKey);
    removeBanner.mutate();
  };

  if (!user.bannerUrl && !isOwner) return null;

  const onUploaded = async ({ url, key }: { url: string; key: string }) => {
    await updateBanner.mutateAsync({ bannerUrl: url, bannerKey: key });
  };

  // Empty, and it is your channel: the strip is the button.
  if (!user.bannerUrl) {
    return (
      <ImageUploadButton
        path={bannerPath(viewerId!)}
        label="Add banner"
        onUploaded={onUploaded}
        className="flex h-24 w-full items-center justify-center gap-1.5 border-b border-dashed border-gray-300 bg-gray-50 text-sm font-semibold text-gray-500"
      >
        <>
          <PlusIcon className="size-4" />
          Add banner
        </>
      </ImageUploadButton>
    );
  }

  return (
    <div className="relative h-28 w-full overflow-hidden">
      <Image
        src={user.bannerUrl}
        alt={`${user.name} banner`}
        fill
        className="object-cover"
        unoptimized
      />

      {isOwner && viewerId && (
        <div className="absolute right-2 top-2 flex gap-1.5">
          <ImageUploadButton
            path={bannerPath(viewerId)}
            label="Replace banner"
            onUploaded={onUploaded}
            className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur"
          >
            Change
          </ImageUploadButton>
          <button
            type="button"
            onClick={onRemove}
            disabled={removeBanner.isPending}
            aria-label="Remove banner"
            className="rounded-full bg-black/60 p-1.5 text-white backdrop-blur disabled:opacity-50"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
