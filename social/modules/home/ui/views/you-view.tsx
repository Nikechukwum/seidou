"use client";

import Link from "next/link";
import {
  ClapperboardIcon,
  FlameIcon,
  HistoryIcon,
  ListVideoIcon,
  PlaySquareIcon,
  ThumbsUpIcon,
  UserIcon,
} from "lucide-react";

import { PageLayout } from "@/components/PageLayout";
import { IconListItem } from "@/components/IconListItem";
import { Button } from "@/components/Button";
import { socialPath } from "@/social/constants";
import { useViewer } from "@/social/hooks/use-viewer";
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
    icon: ClapperboardIcon,
  },
  {
    label: "Playlists",
    description: "Collections you have made",
    href: "/playlists",
    icon: ListVideoIcon,
  },
  {
    label: "Liked videos",
    description: "Everything you have liked",
    href: "/playlists/liked",
    icon: ThumbsUpIcon,
  },
  {
    label: "History",
    description: "Videos you have watched",
    href: "/playlists/history",
    icon: HistoryIcon,
  },
  {
    label: "Subscriptions",
    description: "Channels you follow",
    href: "/feed/subscribed",
    icon: PlaySquareIcon,
  },
  {
    label: "Trending",
    description: "What is popular right now",
    href: "/feed/trending",
    icon: FlameIcon,
  },
];

export const YouView = () => {
  const { viewerId, displayName, avatarUrl, isSignedIn, isLoaded, requireSignIn } =
    useViewer();

  return (
    <PageLayout pageTitle="You" className="bg-white">
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
                  className="size-16"
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

            <div className="space-y-5">
              {ENTRIES.map((entry) => (
                <Link key={entry.href} href={socialPath(entry.href)}>
                  <IconListItem
                    icon={<entry.icon className="size-5.5 text-[#4b5563]" />}
                    title={entry.label}
                    description={entry.description}
                    chevron
                  />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
};
