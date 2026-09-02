"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Trash2Icon,
} from "lucide-react";

import { cn } from "@/social/lib/utils";
import { trpc } from "@/social/trpc/client";
import { toast } from "@/social/lib/toast";
import { socialPath } from "@/social/constants";
import { useViewer } from "@/social/hooks/use-viewer";
import { UserAvatar } from "@/social/components/user-avatar";

import { CommentForm } from "./comment-form";
import { CommentReplies } from "./comment-replies";
import { CommentsGetManyOutput } from "../../types";

interface CommentItemProps {
  comment: CommentsGetManyOutput["items"][number];
  variant?: "comment" | "reply";
}

export const CommentItem = ({ comment, variant = "comment" }: CommentItemProps) => {
  const utils = trpc.useUtils();
  const { viewerId, requireSignIn } = useViewer();

  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [isRepliesOpen, setIsRepliesOpen] = useState(false);

  // Direct id comparison. Upstream compared Clerk ids; public.users.id IS the
  // Supabase auth id, so there is no second identifier.
  const isOwner = viewerId === comment.userId;

  const onError = (error: { data?: { code?: string } | null }) => {
    if (error.data?.code === "UNAUTHORIZED") {
      requireSignIn();
      return;
    }
    toast.error("Something went wrong");
  };

  const invalidate = () => {
    utils.comments.getMany.invalidate({ videoId: comment.videoId });
  };

  const remove = trpc.comments.remove.useMutation({
    onSuccess: () => {
      toast.success("Comment deleted");
      invalidate();
    },
    onError,
  });

  const like = trpc.commentReactions.like.useMutation({
    onSuccess: invalidate,
    onError,
  });

  const dislike = trpc.commentReactions.dislike.useMutation({
    onSuccess: invalidate,
    onError,
  });

  return (
    <div className="flex gap-3">
      <Link prefetch href={socialPath(`/users/${comment.user.id}`)}>
        <UserAvatar
          size={variant === "reply" ? "sm" : "lg"}
          imageUrl={comment.user.imageUrl}
          name={comment.user.name}
        />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link prefetch href={socialPath(`/users/${comment.user.id}`)}>
            <span className="text-sm font-medium">{comment.user.name}</span>
          </Link>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
          </span>
        </div>

        <p className="mt-0.5 whitespace-pre-wrap text-sm">{comment.value}</p>

        <div className="mt-1 flex items-center gap-1">
          <button
            onClick={() => like.mutate({ commentId: comment.id })}
            disabled={like.isPending}
            aria-label="Like comment"
            className="flex items-center gap-1 rounded-full p-2 text-xs disabled:opacity-50"
          >
            <ThumbsUpIcon
              className={cn(
                "size-3.5",
                comment.viewerReaction === "like" && "fill-black"
              )}
            />
            {comment.likeCount}
          </button>

          <button
            onClick={() => dislike.mutate({ commentId: comment.id })}
            disabled={dislike.isPending}
            aria-label="Dislike comment"
            className="flex items-center gap-1 rounded-full p-2 text-xs disabled:opacity-50"
          >
            <ThumbsDownIcon
              className={cn(
                "size-3.5",
                comment.viewerReaction === "dislike" && "fill-black"
              )}
            />
            {comment.dislikeCount}
          </button>

          {/* Only one level of nesting, so replies cannot themselves be replied to. */}
          {variant === "comment" && (
            <button
              onClick={() => setIsReplyOpen(true)}
              className="rounded-full px-2 py-2 text-xs font-semibold"
            >
              Reply
            </button>
          )}

          {isOwner && (
            <button
              onClick={() => remove.mutate({ id: comment.id })}
              disabled={remove.isPending}
              aria-label="Delete comment"
              className="rounded-full p-2 disabled:opacity-50"
            >
              <Trash2Icon className="size-3.5 text-red-600" />
            </button>
          )}
        </div>

        {isReplyOpen && variant === "comment" && (
          <div className="mt-3">
            <CommentForm
              variant="reply"
              videoId={comment.videoId}
              parentId={comment.id}
              onCancel={() => setIsReplyOpen(false)}
              onSuccess={() => {
                setIsReplyOpen(false);
                setIsRepliesOpen(true);
              }}
            />
          </div>
        )}

        {comment.replyCount > 0 && variant === "comment" && (
          <button
            onClick={() => setIsRepliesOpen((current) => !current)}
            className="mt-1 flex items-center gap-1 text-xs font-semibold text-blue-600"
          >
            {isRepliesOpen ? (
              <ChevronUpIcon className="size-4" />
            ) : (
              <ChevronDownIcon className="size-4" />
            )}
            {comment.replyCount} {comment.replyCount === 1 ? "reply" : "replies"}
          </button>
        )}

        {comment.replyCount > 0 && variant === "comment" && isRepliesOpen && (
          <CommentReplies parentId={comment.id} videoId={comment.videoId} />
        )}
      </div>
    </div>
  );
};
