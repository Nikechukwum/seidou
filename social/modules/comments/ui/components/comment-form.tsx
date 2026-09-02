"use client";

import { useState } from "react";

import { trpc } from "@/social/trpc/client";
import { toast } from "@/social/lib/toast";
import { useViewer } from "@/social/hooks/use-viewer";
import { UserAvatar } from "@/social/components/user-avatar";

interface CommentFormProps {
  videoId: string;
  parentId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  variant?: "comment" | "reply";
}

export const CommentForm = ({
  videoId,
  parentId,
  onSuccess,
  onCancel,
  variant = "comment",
}: CommentFormProps) => {
  const utils = trpc.useUtils();
  const { displayName, avatarUrl, requireSignIn } = useViewer();
  const [value, setValue] = useState("");

  const create = trpc.comments.create.useMutation({
    onSuccess: () => {
      utils.comments.getMany.invalidate({ videoId });
      if (parentId) utils.comments.getMany.invalidate({ videoId, parentId });
      setValue("");
      onSuccess?.();
    },
    onError: (error) => {
      if (error.data?.code === "UNAUTHORIZED") {
        requireSignIn();
        return;
      }
      toast.error("Something went wrong");
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    create.mutate({ videoId, parentId, value: value.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <UserAvatar
        size="lg"
        imageUrl={avatarUrl}
        name={displayName || "You"}
      />

      <div className="min-w-0 flex-1">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={2}
          placeholder={
            variant === "reply" ? "Reply to this comment…" : "Add a comment…"
          }
          className="w-full resize-none rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-black focus:ring-1 focus:ring-black"
        />

        <div className="mt-2 flex justify-end gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={create.isPending || !value.trim()}
            className="rounded-full bg-black px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {variant === "reply" ? "Reply" : "Comment"}
          </button>
        </div>
      </div>
    </form>
  );
};
