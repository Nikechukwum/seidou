"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  HeartIcon,
  MessageCircleIcon,
  Share2Icon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";

import { trpc } from "@/social/trpc/client";
import { useViewer } from "@/social/hooks/use-viewer";
import { UserAvatar } from "@/social/components/user-avatar";
import { isOptimizableImage } from "@/social/lib/image";
import { THUMBNAIL_FALLBACK } from "@/social/modules/videos/constants";
import { getYouTubeId } from "@/social/modules/videos/ui/components/video-player";

import { VideoGetManyOutput } from "../../../videos/types";

const YOUTUBE_ORIGIN = "https://www.youtube-nocookie.com";

interface ShortItemProps {
  video: VideoGetManyOutput["items"][number];
  isMuted: boolean;
  onToggleMute: () => void;
  onAction: () => void;
}

/**
 * One full-screen short. The YouTube iframe only mounts while the tile is on
 * screen — a page of ten would otherwise load ten players at once — and the
 * poster below it covers the gap until then.
 */
export const ShortItem = ({
  video,
  isMuted,
  onToggleMute,
  onAction,
}: ShortItemProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const { isLoaded, isSignedIn } = useViewer();
  const createView = trpc.videoViews.create.useMutation();
  const recordedView = useRef(false);

  const youTubeId = video.sourceUrl ? getYouTubeId(video.sourceUrl) : null;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsActive(entry.isIntersecting),
      { threshold: 0.6 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The embed cannot report playback, so a short counts as viewed once the
  // viewer actually reaches it. video_views is unique per (user, video).
  useEffect(() => {
    if (!isActive || !isLoaded || !isSignedIn) return;
    if (recordedView.current) return;

    recordedView.current = true;
    createView.mutate({ videoId: video.id });
    // createView.mutate is stable; recordedView guards the call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isLoaded, isSignedIn, video.id]);

  // Browsers only allow muted autoplay, so the embed always starts muted and
  // the viewer's sound choice is applied over the iframe API once the player
  // reports ready. Commands posted before then are dropped.
  useEffect(() => {
    if (!isActive) {
      setIsPlayerReady(false);
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== YOUTUBE_ORIGIN) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.event === "onReady") setIsPlayerReady(true);
      } catch {
        // Not a player message.
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isActive]);

  useEffect(() => {
    if (!isPlayerReady) return;
    postPlayerCommand(iframeRef.current, isMuted ? "mute" : "unMute");
  }, [isPlayerReady, isMuted]);

  // The player only starts emitting events after a "listening" handshake.
  const handleIframeLoad = () => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "listening", id: video.id, channel: "widget" }),
      YOUTUBE_ORIGIN
    );
  };

  const poster = video.thumbnailUrl || THUMBNAIL_FALLBACK;

  return (
    <div
      ref={ref}
      className="relative h-[calc(100dvh-60px)] w-full snap-start overflow-hidden bg-black"
    >
      {isActive && youTubeId ? (
        <iframe
          ref={iframeRef}
          onLoad={handleIframeLoad}
          src={`${YOUTUBE_ORIGIN}/embed/${youTubeId}?autoplay=1&mute=1&loop=1&playlist=${youTubeId}&controls=0&modestbranding=1&playsinline=1&rel=0&enablejsapi=1`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <Image
          src={poster}
          alt={video.title}
          fill
          sizes="(max-width: 448px) 100vw, 448px"
          quality={65}
          unoptimized={!isOptimizableImage(poster)}
          className="object-cover"
        />
      )}

      {/* Top and bottom scrims keep the white UI readable over bright video. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      {youTubeId && (
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? "Unmute" : "Mute"}
          className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
        >
          {isMuted ? (
            <VolumeXIcon className="size-5" />
          ) : (
            <Volume2Icon className="size-5" />
          )}
        </button>
      )}

      <div className="absolute bottom-20 right-3 flex flex-col items-center gap-5 text-white">
        <ActionButton label="Like" onClick={onAction}>
          <HeartIcon className="size-7" />
        </ActionButton>
        <ActionButton label="Comment" onClick={onAction}>
          <MessageCircleIcon className="size-7" />
        </ActionButton>
        <ActionButton label="Share" onClick={onAction}>
          <Share2Icon className="size-7" />
        </ActionButton>
      </div>

      <div className="absolute inset-x-0 bottom-16 pr-16 pl-4 text-white">
        <div className="flex items-center gap-2">
          <UserAvatar
            size="sm"
            imageUrl={video.user.imageUrl}
            name={video.user.name}
          />
          <span className="truncate text-sm font-semibold">
            {video.user.name}
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-snug">{video.title}</p>
        <p className="mt-1 text-xs text-white/70">
          {Intl.NumberFormat("en", { notation: "compact" }).format(
            video.viewCount
          )}{" "}
          {video.viewCount === 1 ? "view" : "views"}
        </p>
      </div>
    </div>
  );
};

const postPlayerCommand = (iframe: HTMLIFrameElement | null, func: string) => {
  iframe?.contentWindow?.postMessage(
    JSON.stringify({ event: "command", func, args: [] }),
    YOUTUBE_ORIGIN
  );
};

const ActionButton = ({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="flex flex-col items-center gap-1 transition-transform active:scale-90"
  >
    {children}
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);
