"use client";

import { cn } from "@/social/lib/utils";

interface SubscriptionButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isSubscribed: boolean;
  className?: string;
}

export const SubscriptionButton = ({
  onClick,
  disabled,
  isSubscribed,
  className,
}: SubscriptionButtonProps) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "shrink-0 rounded-full px-5 py-2 text-sm font-bold transition-colors disabled:opacity-50",
        isSubscribed
          ? "border border-gray-200 bg-transparent text-black"
          : "bg-black text-white",
        className
      )}
    >
      {isSubscribed ? "Subscribed" : "Subscribe"}
    </button>
  );
};
