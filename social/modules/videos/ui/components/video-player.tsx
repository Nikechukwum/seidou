"use client";

import MuxPlayer from "@mux/mux-player-react";

import { THUMBNAIL_FALLBACK } from "../../constants";

interface VideoPlayerProps {
  playbackId?: string | null;
  /** Imported videos play from here instead of Mux — see getYouTubeId. */
  sourceUrl?: string | null;
  thumbnailUrl?: string | null;
  autoPlay?: boolean;
  onPlay?: () => void;
  // Playback-state events for the watch-time reward (use-watch-reward.ts).
  // `playing` fires once frames actually render, unlike `play`.
  onPlaying?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onWaiting?: () => void;
  onSeeking?: () => void;
}

/**
 * The import JSON's video_url may be a YouTube link in any of its shapes
 * (watch?v=, youtu.be/, /shorts/, /embed/) or a direct file. Returns the
 * YouTube video id, or null for anything else.
 */
export const getYouTubeId = (url: string): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^(www\.|m\.)/, "");
  const idPattern = /^[\w-]{11}$/;

  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1).split("/")[0];
    return idPattern.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const fromQuery = parsed.searchParams.get("v");
    if (fromQuery && idPattern.test(fromQuery)) return fromQuery;

    const [, section, id] = parsed.pathname.split("/");
    if (["embed", "shorts", "live"].includes(section) && idPattern.test(id ?? "")) {
      return id;
    }
  }

  return null;
};

export const VideoPlayerSkeleton = () => {
  return <div className="aspect-video bg-black" />;
};

export const VideoPlayer = ({
  playbackId,
  sourceUrl,
  thumbnailUrl,
  autoPlay,
  onPlay,
  onPlaying,
  onPause,
  onEnded,
  onWaiting,
  onSeeking,
}: VideoPlayerProps) => {
  if (sourceUrl) {
    const youTubeId = getYouTubeId(sourceUrl);

    // The iframe reports no playback events, so a YouTube video records no
    // view and earns no watch reward (the reward also requires a Mux video).
    if (youTubeId) {
      return (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youTubeId}?rel=0&playsinline=1${autoPlay ? "&autoplay=1" : ""}`}
          title="Video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full border-0"
        />
      );
    }

    return (
      <video
        src={sourceUrl}
        poster={thumbnailUrl || THUMBNAIL_FALLBACK}
        controls
        playsInline
        autoPlay={autoPlay}
        preload="metadata"
        className="w-full h-full object-contain"
        onPlay={onPlay}
        onPlaying={onPlaying}
        onPause={onPause}
        onEnded={onEnded}
        onWaiting={onWaiting}
        onSeeking={onSeeking}
      />
    );
  }

  return (
    <MuxPlayer
      playbackId={playbackId || ""}
      poster={thumbnailUrl || THUMBNAIL_FALLBACK}
      playerInitTime={0}
      autoPlay={autoPlay}
      thumbnailTime={0}
      className="w-full h-full object-contain"
      accentColor="#202020"
      onPlay={onPlay}
      onPlaying={onPlaying}
      onPause={onPause}
      onEnded={onEnded}
      onWaiting={onWaiting}
      onSeeking={onSeeking}
    />
  );
};
