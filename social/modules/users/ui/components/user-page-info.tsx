"use client";

import { useState } from "react";
import { PencilIcon } from "lucide-react";

import { Button } from "@/components/Button";
import { trpc } from "@/social/trpc/client";
import { toast } from "@/social/lib/toast";
import { avatarPath } from "@/social/lib/storage";
import { useViewer } from "@/social/hooks/use-viewer";
import { UserAvatar } from "@/social/components/user-avatar";
import { ResponsiveModal } from "@/social/components/responsive-modal";
import { ImageUploadButton } from "@/social/components/image-upload-button";
import { SubscriptionButton } from "@/social/modules/subscriptions/ui/components/subscription-button";
import { useSubscription } from "@/social/modules/subscriptions/hooks/use-subscription";

import { UserGetOneOutput } from "../../types";

interface UserPageInfoProps {
  user: UserGetOneOutput;
}

export const UserPageInfo = ({ user }: UserPageInfoProps) => {
  const utils = trpc.useUtils();
  const { viewerId } = useViewer();
  const [editOpen, setEditOpen] = useState(false);

  const isOwner = viewerId === user.id;

  const { isPending, onClick } = useSubscription({
    userId: user.id,
    isSubscribed: user.viewerSubscribed,
  });

  const updateAvatar = trpc.users.updateAvatar.useMutation({
    onSuccess: () => {
      utils.users.getOne.invalidate({ id: user.id });
      toast.success("Profile picture updated");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
      <div className="relative">
        <UserAvatar size="hero" imageUrl={user.imageUrl} name={user.name} />

        {/* Corner badge, the pattern most apps use for changing a profile
            picture — the avatar stays the avatar, the affordance sits on it. */}
        {isOwner && viewerId && (
          <ImageUploadButton
            path={avatarPath(viewerId)}
            label="Change profile picture"
            onUploaded={async ({ url }) => {
              await updateAvatar.mutateAsync({ avatarUrl: url });
            }}
            className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full border-2 border-white bg-black text-white shadow-sm"
          >
            <PencilIcon className="size-3.5" />
          </ImageUploadButton>
        )}
      </div>

      <div>
        <h1 className="text-xl font-bold">{user.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.subscriberCount}{" "}
          {user.subscriberCount === 1 ? "subscriber" : "subscribers"} •{" "}
          {user.videoCount} {user.videoCount === 1 ? "video" : "videos"}
        </p>
      </div>

      {isOwner ? (
        <>
          <Button
            text="Edit channel"
            bordered
            size="xs"
            onClick={() => setEditOpen(true)}
          />
          <EditChannelModal
            open={editOpen}
            onOpenChange={setEditOpen}
            currentName={user.name}
            userId={user.id}
          />
        </>
      ) : (
        <SubscriptionButton
          onClick={onClick}
          disabled={isPending}
          isSubscribed={user.viewerSubscribed}
        />
      )}
    </div>
  );
};

/**
 * Edits the channel's display name — the name shown on videos and comments.
 *
 * Deliberately not a link to /profile/my-details: that page edits the
 * commerce account (legal name, address, phone, date of birth), none of which
 * belongs on a channel. Until now nothing could change display_name at all;
 * it was derived from the commerce first/last name at signup.
 */
const EditChannelModal = ({
  open,
  onOpenChange,
  currentName,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  userId: string;
}) => {
  const utils = trpc.useUtils();
  const [name, setName] = useState(currentName);

  const updateProfile = trpc.users.updateProfile.useMutation({
    onSuccess: () => {
      utils.users.getOne.invalidate({ id: userId });
      toast.success("Channel updated");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    updateProfile.mutate({ name: name.trim() });
  };

  return (
    <ResponsiveModal
      title="Edit channel"
      open={open}
      onOpenChange={onOpenChange}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div>
          <label className="mb-2 block text-sm font-bold text-gray-700">
            Channel name
          </label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 text-gray-900 outline-none transition-all focus:border-black focus:ring-1 focus:ring-black"
          />
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <PencilIcon className="size-3" />
            Shown on your videos and comments.
          </p>
        </div>

        <button
          type="submit"
          disabled={updateProfile.isPending || !name.trim()}
          className="w-full rounded-full bg-black py-3.5 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {updateProfile.isPending ? "Saving…" : "Save"}
        </button>
      </form>
    </ResponsiveModal>
  );
};
