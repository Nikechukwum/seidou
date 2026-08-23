"use client";

import Link from "next/link";

import { socialPath } from "@/social/constants";
import { UserAvatar } from "@/social/components/user-avatar";
import { useViewer } from "@/social/hooks/use-viewer";
import { Button } from "@/components/Button";
import { SubscriptionButton } from "@/social/modules/subscriptions/ui/components/subscription-button";
import { useSubscription } from "@/social/modules/subscriptions/hooks/use-subscription";

import { VideoGetOneOutput } from "../../types";

interface VideoOwnerProps {
  user: VideoGetOneOutput["user"];
  videoId: string;
}

export const VideoOwner = ({ user, videoId }: VideoOwnerProps) => {
  const { viewerId } = useViewer();

  // Ownership is a direct id comparison. Upstream compared Clerk ids
  // (user.clerkId === userId); with Supabase, public.users.id IS the auth id,
  // so there is no second identifier to reconcile.
  const isOwner = viewerId === user.id;

  const { isPending, onClick } = useSubscription({
    userId: user.id,
    isSubscribed: user.viewerSubscribed,
    fromVideoId: videoId,
  });

  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <Link prefetch href={socialPath(`/users/${user.id}`)}>
        <div className="flex items-center gap-3 min-w-0">
          <UserAvatar size="lg" imageUrl={user.imageUrl} name={user.name} />
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-sm font-medium line-clamp-1">{user.name}</span>
            <span className="text-xs text-muted-foreground line-clamp-1">
              {user.subscriberCount}{" "}
              {user.subscriberCount === 1 ? "subscriber" : "subscribers"}
            </span>
          </div>
        </div>
      </Link>

      {isOwner ? (
        <Link prefetch href={socialPath(`/studio/videos/${videoId}`)}>
          <Button text="Edit video" bordered size="xs" />
        </Link>
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
