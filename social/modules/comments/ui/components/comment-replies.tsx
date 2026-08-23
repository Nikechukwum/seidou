"use client";

import { Loader2Icon } from "lucide-react";

import { trpc } from "@/social/trpc/client";
import { DEFAULT_LIMIT } from "@/social/constants";

import { CommentItem } from "./comment-item";

interface CommentRepliesProps {
  parentId: string;
  videoId: string;
}

/**
 * Replies load on demand rather than with the parent list, so a video with
 * many threads does not fetch everything up front.
 */
export const CommentReplies = ({ parentId, videoId }: CommentRepliesProps) => {
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    trpc.comments.getMany.useInfiniteQuery(
      { limit: DEFAULT_LIMIT, videoId, parentId },
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    );

  return (
    <div className="mt-3 space-y-4 pl-2">
      {isLoading && (
        <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
      )}

      {data?.pages
        .flatMap((page) => page.items)
        .map((comment) => (
          <CommentItem key={comment.id} comment={comment} variant="reply" />
        ))}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="text-xs font-semibold text-blue-600 disabled:opacity-50"
        >
          {isFetchingNextPage ? "Loading…" : "Show more replies"}
        </button>
      )}
    </div>
  );
};
