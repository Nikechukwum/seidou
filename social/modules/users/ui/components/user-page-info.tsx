"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/Button";
import { UserAvatar } from "@/social/components/user-avatar";
import { useViewer } from "@/social/hooks/use-viewer";
import { SubscriptionButton } from "@/social/modules/subscriptions/ui/components/subscription-button";
import { useSubscription } from "@/social/modules/subscriptions/hooks/use-subscription";

import { UserGetOneOutput } from "../../types";

interface UserPageInfoProps {
  user: UserGetOneOutput;
}

export const UserPageInfo = ({ user }: UserPageInfoProps) => {
  const router = useRouter();
  const { viewerId } = useViewer();

  const isOwner = viewerId === user.id;

  const { isPending, onClick } = useSubscription({
    userId: user.id,
    isSubscribed: user.viewerSubscribed,
  });

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
      <UserAvatar size="hero" imageUrl={user.imageUrl} name={user.name} />

      <div>
        <h1 className="text-xl font-bold">{user.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.subscriberCount}{" "}
          {user.subscriberCount === 1 ? "subscriber" : "subscribers"} •{" "}
          {user.videoCount} {user.videoCount === 1 ? "video" : "videos"}
        </p>
      </div>

      {isOwner ? (
        <div className="flex gap-2">
          <Button
            text="Edit profile"
            bordered
            size="xs"
            onClick={() => router.push("/profile/my-details")}
          />
        </div>
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
