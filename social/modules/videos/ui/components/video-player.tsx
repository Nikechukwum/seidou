"use client";

import MuxPlayer from "@mux/mux-player-react";

import { THUMBNAIL_FALLBACK } from "../../constants";

interface VideoPlayerProps {
  playbackId?: string | null;
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

export const VideoPlayerSkeleton = () => {
  return <div className="aspect-video bg-black" />;
};

export const VideoPlayer = ({
  playbackId,
  thumbnailUrl,
  autoPlay,
  onPlay,
  onPlaying,
  onPause,
  onEnded,
  onWaiting,
  onSeeking,
}: VideoPlayerProps) => {
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
