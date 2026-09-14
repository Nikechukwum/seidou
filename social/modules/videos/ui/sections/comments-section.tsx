"use client";

import { Suspense, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, Loader2Icon } from "lucide-react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/social/trpc/client";
import { DEFAULT_LIMIT } from "@/social/constants";
import { UserAvatar } from "@/social/components/user-avatar";
import { InfiniteScroll } from "@/social/components/infinite-scroll";
import { CommentForm } from "@/social/modules/comments/ui/components/comment-form";
import { CommentItem } from "@/social/modules/comments/ui/components/comment-item";

interface CommentsSectionProps {
  videoId: string;
}

export const CommentsSection = ({ videoId }: CommentsSectionProps) => {
  // ErrorBoundary outside Suspense — see the note in video-section.tsx.
  return (
    <ErrorBoundary
      fallback={
        <p className="py-4 text-sm text-muted-foreground">
          Could not load comments.
        </p>
      }
    >
      <Suspense
        fallback={
          <Loader2Icon className="mx-auto size-5 animate-spin text-muted-foreground" />
        }
      >
        <CommentsSectionSuspense videoId={videoId} />
      </Suspense>
    </ErrorBoundary>
  );
};

const CommentsHeading = ({
  totalCount,
  isExpanded,
}: {
  totalCount: number;
  isExpanded: boolean;
}) => {
  return (
    <span className="flex items-center justify-between">
      <span className="flex items-baseline gap-2 text-sm font-semibold">
        Comments
        <span className="font-normal text-muted-foreground">{totalCount}</span>
      </span>
      {isExpanded ? (
        <ChevronUpIcon className="size-4" />
      ) : (
        <ChevronDownIcon className="size-4" />
      )}
    </span>
  );
};

/**
 * Collapsed by default into a card previewing the first comment, so the
 * watch page leads with "Up next" rather than a long thread. Tapping the card
 * expands the full section in place; only the heading collapses it again, so
 * typing, liking or replying never closes it by accident.
 */
const CommentsSectionSuspense = ({ videoId }: CommentsSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const [comments, query] = trpc.comments.getMany.useSuspenseInfiniteQuery(
    { videoId, limit: DEFAULT_LIMIT },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const items = comments.pages.flatMap((page) => page.items);
  const totalCount = comments.pages[0].totalCount;
  const firstComment = items[0];

  if (!isExpanded) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => setIsExpanded(true)}
        className="w-full rounded-xl bg-secondary/50 p-3 text-left"
      >
        <CommentsHeading totalCount={totalCount} isExpanded={false} />

        {firstComment ? (
          <span className="mt-2 flex items-center gap-2">
            <UserAvatar
              size="sm"
              imageUrl={firstComment.user.imageUrl}
              name={firstComment.user.name}
            />
            <span className="min-w-0 flex-1 text-sm line-clamp-2">
              {firstComment.value}
            </span>
          </span>
        ) : (
          <span className="mt-2 block text-sm text-muted-foreground">
            No comments yet. Tap to add one.
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl bg-secondary/50 p-3">
      <button
        type="button"
        aria-expanded
        onClick={() => setIsExpanded(false)}
        className="w-full text-left"
      >
        <CommentsHeading totalCount={totalCount} isExpanded />
      </button>

      <CommentForm videoId={videoId} />

      <div className="flex flex-col gap-6">
        {items.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>

      {/* Only while there is more to load, which shows the "Load more"
          button. With nothing left it would render the end-of-list dot, whose
          padding leaves a gap above the suggestions below. isManual: more
          comments load only when asked for, not while scrolling past. */}
      {query.hasNextPage && (
        <InfiniteScroll
          isManual
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          fetchNextPage={query.fetchNextPage}
        />
      )}
    </div>
  );
};
