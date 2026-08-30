"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ClockIcon,
  FireIcon,
  HandThumbUpIcon,
  PlayCircleIcon,
  RectangleStackIcon,
  UserIcon,
  VideoCameraIcon,
} from "@heroicons/react/20/solid";

import { PageLayout } from "@/components/PageLayout";
import { IconListItem } from "@/components/IconListItem";
import { Button } from "@/components/Button";
import { socialPath } from "@/social/constants";
import { useViewer } from "@/social/hooks/use-viewer";
import { Modal } from "@/components/Modal";
import { UserAvatar } from "@/social/components/user-avatar";

/**
 * The equivalent of YouTube's "You" tab, and of the clone's sidebar.
 *
 * The clone grouped these in a desktop sidebar: Home / Subscribed / Trending
 * in one section, History / Liked / Playlists in another, with My profile and
 * Studio behind the account menu. Inside a max-w-md shell a sidebar has
 * nowhere to live, and flattening it into a chip strip put a second row of
 * pills directly above the category chips — two near-identical rows that read
 * as one confused control. Collapsing it into a destination instead keeps the
 * feed to a single row of chips, as the clone had.
 */
const ENTRIES = [
  {
    label: "Your videos",
    description: "Upload and manage your videos",
    href: "/studio",
    icon: VideoCameraIcon,
  },
  {
    label: "Playlists",
    description: "Collections you have made",
    href: "/playlists",
    icon: RectangleStackIcon,
  },
  {
    label: "Liked videos",
    description: "Everything you have liked",
    href: "/playlists/liked",
    icon: HandThumbUpIcon,
  },
  {
    label: "History",
    description: "Videos you have watched",
    href: "/playlists/history",
    icon: ClockIcon,
  },
  {
    label: "Subscriptions",
    description: "Channels you follow",
    href: "/feed/subscribed",
    icon: PlayCircleIcon,
  },
  {
    label: "Trending",
    description: "What is popular right now",
    // No href: ranked purely by view count, which says nothing useful until
    // there is real traffic. The route exists and works — it is the data that
    // is not ready, so the entry shows a placeholder instead of linking.
    href: null,
    icon: FireIcon,
  },
];

export const SocialProfileView = () => {
  const [inProgress, setInProgress] = useState<string | null>(null);
  const { viewerId, displayName, avatarUrl, isSignedIn, isLoaded, requireSignIn } =
    useViewer();

  return (
    <PageLayout pageTitle="Social Profile" className="bg-white">
      <div className="px-6 space-y-8">
        {isLoaded && !isSignedIn ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <UserIcon className="size-10 text-gray-300" />
            <p className="text-sm text-muted-foreground">
              Sign in to see your videos, playlists and history.
            </p>
            <Button text="Sign in" onClick={requireSignIn} size="sm" />
          </div>
        ) : (
          <>
            {viewerId && (
              <Link
                href={socialPath(`/users/${viewerId}`)}
                className="flex items-center gap-4"
              >
                <UserAvatar
                  size="xl"
                  imageUrl={avatarUrl}
                  name={displayName || "You"}
                />
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold">
                    {displayName || "Your channel"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    View your channel
                  </p>
                </div>
              </Link>
            )}

            <div className="flex flex-col gap-y-4">
              {ENTRIES.map((entry) => {
                const item = (
                  <IconListItem
                    icon={<entry.icon className="size-5.5 text-[#4b5563]" />}
                    title={entry.label}
                    description={entry.description}
                    chevron
                  />
                );

                return entry.href ? (
                  <Link key={entry.label} href={socialPath(entry.href)}>
                    {item}
                  </Link>
                ) : (
                  <div
                    key={entry.label}
                    onClick={() => setInProgress(entry.label)}
                  >
                    {item}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Modal isActive={!!inProgress} setIsActive={() => setInProgress(null)}>
        <div className="text-center">
          <h2 className="text-lg font-bold">Feature in progress</h2>
          <p className="mt-2 text-sm text-gray-500">
            {inProgress} is still being built. It will open here once it is
            ready.
          </p>
          <button
            onClick={() => setInProgress(null)}
            className="mt-6 w-full rounded-full bg-black py-3.5 text-sm font-bold text-white transition-transform active:scale-[0.98]"
          >
            Got it
          </button>
        </div>
      </Modal>
    </PageLayout>
  );
};
