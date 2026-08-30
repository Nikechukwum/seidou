"use client";

import Image from "next/image";

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
 * Renders nothing for a visitor when the channel has no banner.
 *
 * Upstream always drew the block with a flat-colour fallback, which read as a
 * broken image rather than an empty slot. The owner still gets an affordance
 * to add one, so the feature is discoverable without imposing dead space on
 * everyone else.
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
    if (user.bannerKey) {
      await deleteSocialImage(user.bannerKey);
    }
    removeBanner.mutate();
  };

  if (!user.bannerUrl && !isOwner) return null;

  return (
    <div className="relative">
      {user.bannerUrl ? (
        <div className="relative h-28 w-full overflow-hidden">
          <Image
            src={user.bannerUrl}
            alt={`${user.name} banner`}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      ) : (
        <div className="flex h-20 w-full items-center justify-center border-b border-dashed border-gray-200 bg-gray-50">
          <p className="text-xs text-muted-foreground">No banner yet</p>
        </div>
      )}

      {isOwner && viewerId && (
        <div className="flex justify-center gap-2 px-4 py-2">
          <ImageUploadButton
            path={bannerPath(viewerId)}
            label={user.bannerUrl ? "Replace banner" : "Add banner"}
            onUploaded={async ({ url, key }) => {
              await updateBanner.mutateAsync({ bannerUrl: url, bannerKey: key });
            }}
          />
          {user.bannerUrl && (
            <button
              type="button"
              onClick={onRemove}
              disabled={removeBanner.isPending}
              className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
};
