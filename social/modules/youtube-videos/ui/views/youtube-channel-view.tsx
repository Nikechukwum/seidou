"use client";

import Image from "next/image";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { Header } from "@/components/Header";
import { trpc } from "@/social/trpc/client";
import { Skeleton } from "@/social/components/ui/skeleton";
import { UserAvatar } from "@/social/components/user-avatar";

import { YouTubeGridCard } from "../components/youtube-grid-card";

/**
 * An imported YouTube channel, laid out like a user's channel page (banner
 * flush under the header, centred avatar and name, then the videos) — without
 * subscribe or editing, which belong to Seidou accounts.
 */
export const YouTubeChannelView = ({ handle }: { handle: string }) => {
  return (
    <div className="min-h-lvh bg-white pt-16 pb-20">
      <Header pageTitle="Channel" />
      <ErrorBoundary fallback={<p className="px-4 py-8 text-sm text-muted-foreground">This channel is unavailable.</p>}>
        <Suspense fallback={<YouTubeChannelSkeleton />}>
          <YouTubeChannelSuspense handle={handle} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

const YouTubeChannelSkeleton = () => (
  <div className="flex flex-col items-center gap-3 px-4 py-6">
    <Skeleton className="size-28 rounded-full" />
    <Skeleton className="h-6 w-40" />
    <Skeleton className="h-4 w-52" />
  </div>
);

const YouTubeChannelSuspense = ({ handle }: { handle: string }) => {
  const [{ channel, videos }] = trpc.youtubeVideos.getChannel.useSuspenseQuery({ handle });

  return (
    <div className="flex flex-col gap-6">
      <div>
        {channel.bannerUrl && (
          <div className="relative h-28 w-full overflow-hidden">
            <Image
              src={channel.bannerUrl}
              alt={`${channel.name} banner`}
              fill
              sizes="(max-width: 448px) 100vw, 448px"
              quality={70}
              className="object-cover"
            />
          </div>
        )}

        <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
          <UserAvatar size="hero" imageUrl={channel.avatarUrl} name={channel.name} />
          <div>
            <h1 className="text-xl font-bold">{channel.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {[channel.handle, channel.subscribersText].filter(Boolean).join(" • ")}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-4">
        {videos.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No videos here yet.</p>
        ) : (
          videos.map((video) => <YouTubeGridCard key={video.id} data={video} />)
        )}
      </div>
    </div>
  );
};
