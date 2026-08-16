"use client";

import { z } from "zod";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ErrorBoundary } from "react-error-boundary";
import { CopyCheckIcon, CopyIcon, Loader2Icon, TrashIcon } from "lucide-react";

import { trpc } from "@/social/trpc/client";
import { toast } from "@/social/lib/toast";
import { socialPath, socialUrl } from "@/social/constants";
import { Skeleton } from "@/social/components/ui/skeleton";
import { Button } from "@/components/Button";
import { VideoPlayer } from "@/social/modules/videos/ui/components/video-player";

interface FormSectionProps {
  videoId: string;
}

/**
 * Hand-written rather than ported: upstream used shadcn Form + Select +
 * Textarea + DropdownMenu, which would have pulled in four more Radix
 * packages for a form that has to fit a max-w-md column anyway. Fields are
 * styled to match Seidou's own forms (see app/signup/page.tsx).
 *
 * The AI title/description/thumbnail buttons are deliberately absent — those
 * depend on Upstash Workflow and OpenAI, which are deferred.
 */
const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().nullish(),
  categoryId: z.string().uuid().nullish(),
  visibility: z.enum(["private", "public"]),
});

type FormValues = z.infer<typeof formSchema>;

export const FormSection = ({ videoId }: FormSectionProps) => {
  return (
    <ErrorBoundary
      fallback={
        <p className="px-4 py-8 text-sm text-muted-foreground">
          Could not load this video.
        </p>
      }
    >
      <Suspense fallback={<FormSectionSkeleton />}>
        <FormSectionSuspense videoId={videoId} />
      </Suspense>
    </ErrorBoundary>
  );
};

const FormSectionSkeleton = () => (
  <div className="space-y-4 px-4">
    <Skeleton className="aspect-video w-full rounded-xl" />
    <Skeleton className="h-12 w-full rounded-2xl" />
    <Skeleton className="h-28 w-full rounded-2xl" />
    <Skeleton className="h-12 w-full rounded-2xl" />
  </div>
);

const inputClass =
  "w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-black focus:ring-1 focus:ring-black";

const FormSectionSuspense = ({ videoId }: FormSectionProps) => {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [copied, setCopied] = useState(false);

  const [video] = trpc.studio.getOne.useSuspenseQuery({ id: videoId });
  const [categories] = trpc.categories.getMany.useSuspenseQuery();

  /**
   * While a video is still processing, ask Mux on a timer instead of making
   * the user click Refresh. getStatus stops calling Mux once the row reaches a
   * terminal state, and refetchInterval returns false there so the polling
   * stops too.
   *
   * 4s rather than 1-2s: each tick costs two Mux API calls, and transcoding
   * takes tens of seconds, so a tighter loop multiplies API traffic without
   * the user noticing any difference.
   */
  const isProcessing =
    video.muxStatus !== "ready" && video.muxStatus !== "errored";

  const status = trpc.videos.getStatus.useQuery(
    { id: videoId },
    {
      enabled: isProcessing,
      refetchInterval: (query) => {
        const s = query.state.data?.muxStatus;
        return s === "ready" || s === "errored" ? false : 4000;
      },
      refetchOnWindowFocus: false,
    }
  );

  // When the poll sees it go ready, refresh the form's own copy so the player
  // picks up the new playback id.
  const polledStatus = status.data?.muxStatus;
  useEffect(() => {
    if (!polledStatus) return;
    if (polledStatus === video.muxStatus) return;

    utils.studio.getOne.invalidate({ id: videoId });
    utils.studio.getMany.invalidate();

    if (polledStatus === "ready") toast.success("Video is ready");
    if (polledStatus === "errored") toast.error("Mux could not process this video");
  }, [polledStatus, video.muxStatus, utils, videoId]);

  const update = trpc.videos.update.useMutation({
    onSuccess: () => {
      utils.studio.getMany.invalidate();
      utils.studio.getOne.invalidate({ id: videoId });
      toast.success("Video updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const remove = trpc.videos.remove.useMutation({
    onSuccess: () => {
      utils.studio.getMany.invalidate();
      toast.success("Video removed");
      router.push(socialPath("/studio"));
    },
    onError: (error) => toast.error(error.message),
  });

  const revalidate = trpc.videos.revalidate.useMutation({
    onSuccess: () => {
      utils.studio.getOne.invalidate({ id: videoId });
      toast.success("Refreshed from Mux");
    },
    onError: (error) => toast.error(error.message),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: video.title,
      description: video.description ?? "",
      categoryId: video.categoryId,
      visibility: video.visibility,
    },
  });

  const onSubmit = (values: FormValues) => {
    update.mutate({ ...values, id: videoId });
  };

  const onCopy = async () => {
    await navigator.clipboard.writeText(socialUrl(`/videos/${videoId}`));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 px-4">
      <div className="aspect-video overflow-hidden rounded-xl bg-black">
        <VideoPlayer
          playbackId={video.muxPlaybackId}
          thumbnailUrl={video.thumbnailUrl}
        />
      </div>

      {isProcessing && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-yellow-50 px-4 py-3">
          <p className="flex items-center gap-2 text-xs text-yellow-900">
            <Loader2Icon className="size-3 animate-spin" />
            Processing ({video.muxStatus ?? "waiting"}) — this updates itself.
          </p>
          {/* Manual fallback: still worth having if the poll is wedged. */}
          <button
            type="button"
            onClick={() => revalidate.mutate({ id: videoId })}
            disabled={revalidate.isPending}
            className="shrink-0 text-xs font-semibold underline disabled:opacity-50"
          >
            {revalidate.isPending ? "Checking…" : "Check now"}
          </button>
        </div>
      )}

      {video.muxStatus === "errored" && (
        <div className="rounded-xl bg-red-50 px-4 py-3">
          <p className="text-xs text-red-900">
            Mux could not process this video. Try uploading it again.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-2xl bg-gray-50 px-4 py-3">
        <Link
          prefetch
          href={socialPath(`/videos/${videoId}`)}
          className="min-w-0 flex-1 truncate text-xs text-blue-600"
        >
          {socialUrl(`/videos/${videoId}`)}
        </Link>
        <button type="button" onClick={onCopy} aria-label="Copy link">
          {copied ? (
            <CopyCheckIcon className="size-4" />
          ) : (
            <CopyIcon className="size-4" />
          )}
        </button>
      </div>

      <div>
        <label className="mb-2 block text-sm font-bold text-gray-700">Title</label>
        <input {...form.register("title")} className={inputClass} placeholder="Add a title" />
        {form.formState.errors.title && (
          <p className="mt-1 text-xs text-red-600">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-bold text-gray-700">
          Description
        </label>
        <textarea
          {...form.register("description")}
          rows={5}
          className={`${inputClass} resize-none`}
          placeholder="Tell viewers about your video"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-bold text-gray-700">Category</label>
        <select {...form.register("categoryId")} className={inputClass}>
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-bold text-gray-700">
          Visibility
        </label>
        <select {...form.register("visibility")} className={inputClass}>
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={update.isPending}
          className="flex-1 rounded-full bg-black py-3.5 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {update.isPending ? (
            <Loader2Icon className="mx-auto size-4 animate-spin" />
          ) : (
            "Save changes"
          )}
        </button>

        <button
          type="button"
          onClick={() => remove.mutate({ id: videoId })}
          disabled={remove.isPending}
          aria-label="Delete video"
          className="rounded-full border border-gray-200 p-3.5 disabled:opacity-50"
        >
          <TrashIcon className="size-4 text-red-600" />
        </button>
      </div>
    </form>
  );
};
