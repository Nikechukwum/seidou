"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/social/trpc/client";
import { Skeleton } from "@/social/components/ui/skeleton";

import { UserPageInfo } from "../components/user-page-info";
import { UserPageBanner } from "../components/user-page-banner";

interface UserSectionProps {
  userId: string;
}

export const UserSection = ({ userId }: UserSectionProps) => {
  // ErrorBoundary outside Suspense — see the note in video-section.tsx.
  return (
    <ErrorBoundary
      fallback={
        <p className="px-4 py-8 text-sm text-muted-foreground">
          This channel is unavailable.
        </p>
      }
    >
      <Suspense fallback={<UserSectionSkeleton />}>
        <UserSectionSuspense userId={userId} />
      </Suspense>
    </ErrorBoundary>
  );
};

const UserSectionSkeleton = () => (
  <div>
    <div className="flex flex-col items-center gap-3 px-4 py-6">
      <Skeleton className="size-28 rounded-full" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-52" />
    </div>
  </div>
);

const UserSectionSuspense = ({ userId }: UserSectionProps) => {
  const [user] = trpc.users.getOne.useSuspenseQuery({ id: userId });

  return (
    <div>
      <UserPageBanner user={user} />
      <UserPageInfo user={user} />
    </div>
  );
};
