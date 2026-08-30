"use client";

import { Suspense } from "react";
import { Loader2Icon } from "lucide-react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/social/trpc/client";
import { DEFAULT_LIMIT } from "@/social/constants";
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

const CommentsSectionSuspense = ({ videoId }: CommentsSectionProps) => {
  const [comments, query] = trpc.comments.getMany.useSuspenseInfiniteQuery(
    { videoId, limit: DEFAULT_LIMIT },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const items = comments.pages.flatMap((page) => page.items);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-sm font-semibold">
        {comments.pages[0].totalCount} comments
      </h2>

      <CommentForm videoId={videoId} />

      <div className="flex flex-col gap-6">
        {items.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>

      {/* isManual: comments sit below suggestions, so auto-loading them while
          the reader scrolls past would fetch pages nobody asked for. */}
      <InfiniteScroll
        isManual
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        fetchNextPage={query.fetchNextPage}
      />
    </div>
  );
};
