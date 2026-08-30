"use client";

import Image from "next/image";
import { useState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";

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
 * and is the upload trigger, rather than a placeholder above a separate
 * button. Visitors see nothing at all when there is no banner.
 */
export const UserPageBanner = ({ user }: UserPageBannerProps) => {
  const utils = trpc.useUtils();
  const { viewerId } = useViewer();
  const [menuOpen, setMenuOpen] = useState(false);

  const isOwner = viewerId === user.id;

  const updateBanner = trpc.users.updateBanner.useMutation({
    onSuccess: () => {
      utils.users.getOne.invalidate({ id: user.id });
      toast.success("Banner updated");
      setMenuOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const removeBanner = trpc.users.removeBanner.useMutation({
    onSuccess: () => {
      utils.users.getOne.invalidate({ id: user.id });
      toast.success("Banner removed");
      setMenuOpen(false);
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
    <div className="relative h-28 w-full">
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src={user.bannerUrl}
          alt={`${user.name} banner`}
          fill
          className="object-cover"
          unoptimized
        />
      </div>

      {isOwner && viewerId && (
        <div className="absolute right-2 top-2">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Edit banner"
            aria-expanded={menuOpen}
            className="rounded-full bg-black/60 p-2 text-white backdrop-blur"
          >
            <PencilIcon className="size-3.5" />
          </button>

          {menuOpen && (
            <>
              {/* Catches the outside tap that should dismiss the menu. */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />

              <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                <ImageUploadButton
                  path={bannerPath(viewerId)}
                  label="Change banner"
                  onUploaded={onUploaded}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium"
                >
                  Change
                </ImageUploadButton>

                <button
                  type="button"
                  onClick={onRemove}
                  disabled={removeBanner.isPending}
                  className="w-full border-t border-gray-100 px-4 py-2.5 text-left text-sm font-medium text-red-600 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
