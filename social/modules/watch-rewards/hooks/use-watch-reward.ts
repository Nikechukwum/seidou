"use client";

import { useCallback, useEffect, useRef } from "react";

import { store } from "@/redux/store";
import { PartialUpdateUser } from "@/redux/authSlice";
import { toast } from "@/social/lib/toast";
import { trpc } from "@/social/trpc/client";

import {
  WATCH_REWARD_AMOUNT,
  WATCH_REWARD_HEARTBEAT_INTERVAL_MS,
  WATCH_REWARD_MAX_BACKOFF_TICKS,
} from "../constants";

type HeartbeatEvent = "beat" | "stop";

// Errors that retrying won't fix: stop reporting for this video.
const FATAL_CODES = new Set(["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "BAD_REQUEST"]);

// Dev-only trace for testing; silent in production builds.
const debug = (...args: unknown[]) => {
  if (process.env.NODE_ENV === "development") console.log("[watch-rewards]", ...args);
};

interface UseWatchRewardProps {
  videoId: string;
  enabled: boolean;
}

/**
 * Reports watch time for the loyalty reward and returns the player event
 * handlers to spread into <VideoPlayer>.
 *
 * Heartbeats go out every 15s only while the video is actually playing in a
 * visible tab. The server measures the time between them, so this hook only
 * says "still watching" — it never sends a duration or a timestamp.
 *
 * All state lives in refs: nothing here should re-render the watch page.
 * Grant handling sits in the useMutation callbacks rather than per-call ones,
 * because those still run after unmount — the final "stop" can be the beat
 * that earns a reward.
 */
export const useWatchReward = ({ videoId, enabled }: UseWatchRewardProps) => {
  const videoIdRef = useRef(videoId);
  const enabledRef = useRef(enabled);
  const playingRef = useRef(false);
  // True once a beat has started the server clock and no stop has followed.
  const runningRef = useRef(false);
  const inFlightRef = useRef(false);
  const cappedRef = useRef(false);
  const disabledRef = useRef(false);
  const skipTicksRef = useRef(0);
  const backoffRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const capTimeoutRef = useRef<number | null>(null);
  const sendRef = useRef<(event: HeartbeatEvent) => void>(() => {});

  const halt = useCallback((sendStop: boolean) => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (sendStop && runningRef.current) {
      runningRef.current = false;
      sendRef.current("stop");
    }
  }, []);

  const tick = useCallback(() => {
    if (skipTicksRef.current > 0) {
      skipTicksRef.current -= 1;
      return;
    }
    if (inFlightRef.current) return;
    runningRef.current = true;
    sendRef.current("beat");
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current !== null || !playingRef.current) return;
    if (!enabledRef.current) return debug("playing, but not eligible (see the eligibility line)");
    if (disabledRef.current) return debug("playing, but disabled after the server rejected a heartbeat");
    if (cappedRef.current) return debug("playing, but the reward cap is reached");
    if (document.visibilityState !== "visible") return;
    debug(`start: heartbeat now, then every ${WATCH_REWARD_HEARTBEAT_INTERVAL_MS / 1000}s`);
    tick();
    intervalRef.current = window.setInterval(tick, WATCH_REWARD_HEARTBEAT_INTERVAL_MS);
  }, [tick]);

  const heartbeat = trpc.watchRewards.heartbeat.useMutation({
    retry: false,
    onSuccess: (data) => {
      debug(
        `ok +${(data.creditedMs / 1000).toFixed(1)}s, progress ${(data.progressMs / 1000).toFixed(1)}s / ${data.msPerReward / 1000}s, window ${data.windowGrants}/${data.cap}` +
          (data.granted ? `, GRANTED ${data.granted}` : "") +
          (data.capReached ? `, CAP REACHED (frees in ${Math.round((data.capFreesInMs ?? 0) / 60000)} min)` : "")
      );
      backoffRef.current = 0;

      if (data.granted > 0) {
        if (data.loyaltyRewards) {
          store.dispatch(PartialUpdateUser({ loyalty_rewards: data.loyaltyRewards }));
        }
        toast.success(
          `B ${(data.granted * WATCH_REWARD_AMOUNT).toLocaleString()} reward saved to your Land Wars Wallet.`
        );
      }

      if (data.capReached) {
        // The server has stopped the clock; wait for the window to reset.
        cappedRef.current = true;
        runningRef.current = false;
        halt(false);

        if (capTimeoutRef.current !== null) window.clearTimeout(capTimeoutRef.current);
        capTimeoutRef.current = null;

        if (data.capFreesInMs !== null && enabledRef.current) {
          capTimeoutRef.current = window.setTimeout(() => {
            capTimeoutRef.current = null;
            cappedRef.current = false;
            start();
          }, data.capFreesInMs + 1000);
        }
      }
    },
    onError: (error, variables) => {
      debug(`error on ${variables.event}:`, error.data?.code ?? error.message);
      if (FATAL_CODES.has(error.data?.code ?? "")) {
        disabledRef.current = true;
        runningRef.current = false;
        halt(false);
        return;
      }

      // Transient failure: skip 1, 2, 4, then 8 ticks. Never toast —
      // playback must not be disturbed by reward bookkeeping.
      if (variables.event === "beat") {
        backoffRef.current =
          backoffRef.current === 0
            ? 1
            : Math.min(backoffRef.current * 2, WATCH_REWARD_MAX_BACKOFF_TICKS);
        skipTicksRef.current = backoffRef.current;
      }
    },
    onSettled: (_data, _error, variables) => {
      if (variables.event === "beat") inFlightRef.current = false;
    },
  });

  const { mutate } = heartbeat;

  useEffect(() => {
    sendRef.current = (event) => {
      debug(`send ${event}`);
      if (event === "beat") inFlightRef.current = true;
      mutate({ videoId: videoIdRef.current, event });
    };
  }, [mutate]);

  // A different video has not started playing yet, whatever the last one did.
  // Declared before the effect below so its cleanup runs first.
  useEffect(() => {
    return () => {
      playingRef.current = false;
    };
  }, [videoId]);

  useEffect(() => {
    debug(`video ${videoId}: ${enabled ? "eligible" : "not eligible"}`);
    videoIdRef.current = videoId;
    enabledRef.current = enabled;
    disabledRef.current = false;
    cappedRef.current = false;
    skipTicksRef.current = 0;
    backoffRef.current = 0;

    // Covers playback that began before `enabled` became true, e.g. while
    // the viewer's session was still loading.
    start();

    const onVisibilityChange = () => {
      debug(`tab ${document.visibilityState}`);
      if (document.visibilityState === "visible") start();
      else halt(true);
    };
    // Best effort: if this request is lost, the server's stale-gap rule
    // means the time in between is simply not credited.
    const onPageHide = () => halt(true);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      // videoIdRef still holds the outgoing video here.
      halt(true);
      enabledRef.current = false;
      if (capTimeoutRef.current !== null) {
        window.clearTimeout(capTimeoutRef.current);
        capTimeoutRef.current = null;
      }
    };
  }, [videoId, enabled, start, halt]);

  const onPlaying = useCallback(() => {
    debug("player: playing");
    playingRef.current = true;
    start();
  }, [start]);

  // Pause and end credit the partial interval and stop the server clock.
  const onPause = useCallback(() => {
    debug("player: paused/ended");
    playingRef.current = false;
    halt(true);
  }, [halt]);

  // Buffering and seeking just pause reporting; the next `playing` resumes.
  const onWaiting = useCallback(() => {
    debug("player: buffering/seeking");
    playingRef.current = false;
    halt(false);
  }, [halt]);

  return {
    onPlaying,
    onPause,
    onEnded: onPause,
    onWaiting,
    onSeeking: onWaiting,
  };
};
