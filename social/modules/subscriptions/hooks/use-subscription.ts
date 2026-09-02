"use client";

import { trpc } from "@/social/trpc/client";
import { toast } from "@/social/lib/toast";
import { useViewer } from "@/social/hooks/use-viewer";

interface UseSubscriptionProps {
  userId: string;
  isSubscribed: boolean;
  fromVideoId?: string;
}

/**
 * Shared by the watch page and the channel page so both stay in sync after a
 * subscribe or unsubscribe.
 */
export const useSubscription = ({
  userId,
  isSubscribed,
  fromVideoId,
}: UseSubscriptionProps) => {
  const utils = trpc.useUtils();
  const { requireSignIn } = useViewer();

  const onError = (error: { data?: { code?: string } | null }) => {
    if (error.data?.code === "UNAUTHORIZED") {
      requireSignIn();
      return;
    }
    toast.error("Something went wrong");
  };

  const invalidate = () => {
    utils.videos.getManySubscribed.invalidate();
    utils.subscriptions.getMany.invalidate();
    if (fromVideoId) utils.videos.getOne.invalidate({ id: fromVideoId });
  };

  const subscribe = trpc.subscriptions.create.useMutation({
    onSuccess: () => {
      toast.success("Subscribed");
      invalidate();
    },
    onError,
  });

  const unsubscribe = trpc.subscriptions.remove.useMutation({
    onSuccess: () => {
      toast.success("Unsubscribed");
      invalidate();
    },
    onError,
  });

  const isPending = subscribe.isPending || unsubscribe.isPending;

  const onClick = () => {
    if (isSubscribed) {
      unsubscribe.mutate({ userId });
    } else {
      subscribe.mutate({ userId });
    }
  };

  return { isPending, onClick };
};
