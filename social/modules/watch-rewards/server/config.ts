import "server-only";

import {
  WATCH_REWARD_AMOUNT,
  WATCH_REWARD_CAP,
  WATCH_REWARD_CAP_WINDOW_MS,
  WATCH_REWARD_MAX_CREDIT_PER_BEAT_MS,
  WATCH_REWARD_SECONDS_PER_REWARD,
  WATCH_REWARD_STALE_GAP_MS,
} from "../constants";

export interface WatchRewardConfig {
  amount: number;
  msPerReward: number;
  cap: number;
  capWindowMs: number;
  maxCreditPerBeatMs: number;
  staleGapMs: number;
}

let warned = false;

const readDevInt = (name: string, min: number) => {
  const raw = process.env[name];
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= min ? value : null;
};

/**
 * Effective reward settings.
 *
 * Waiting 5 real minutes per reward makes the flow slow to test, so
 * WATCH_REWARD_DEV_SECONDS_PER_REWARD (min 30) and WATCH_REWARD_DEV_CAP
 * (min 1) can shorten it — but only under `npm run dev`. `next build` and
 * `next start` always run with NODE_ENV=production, so a deployed build
 * ignores these variables even if they are set. They have no NEXT_PUBLIC_
 * prefix, so they never reach the browser either.
 */
export const getWatchRewardConfig = (): WatchRewardConfig => {
  let secondsPerReward = WATCH_REWARD_SECONDS_PER_REWARD;
  let cap = WATCH_REWARD_CAP;

  if (process.env.NODE_ENV === "development") {
    const devSeconds = readDevInt("WATCH_REWARD_DEV_SECONDS_PER_REWARD", 30);
    const devCap = readDevInt("WATCH_REWARD_DEV_CAP", 1);

    if (devSeconds !== null) secondsPerReward = devSeconds;
    if (devCap !== null) cap = devCap;

    if ((devSeconds !== null || devCap !== null) && !warned) {
      warned = true;
      console.warn(
        `[watch-rewards] Dev override active: ${secondsPerReward}s per reward, cap ${cap}.`
      );
    }
  }

  return {
    amount: WATCH_REWARD_AMOUNT,
    msPerReward: secondsPerReward * 1000,
    cap,
    capWindowMs: WATCH_REWARD_CAP_WINDOW_MS,
    maxCreditPerBeatMs: WATCH_REWARD_MAX_CREDIT_PER_BEAT_MS,
    staleGapMs: WATCH_REWARD_STALE_GAP_MS,
  };
};
