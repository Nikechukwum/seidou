import type { WatchRewardConfig } from "./config";

/** What to do with window_started_at: leave it, set it to now(), or clear it. */
export type WindowAction = "keep" | "open" | "clear";

export interface AccrualInput {
  progressMs: number;
  /** ms since the last heartbeat, or null when the clock is not running. */
  gapMs: number | null;
  windowGrants: number;
  /** ms since the current window opened, or null when none is open. */
  windowAgeMs: number | null;
}

export interface AccrualResult {
  creditedMs: number;
  progressMs: number;
  newGrants: number;
  windowGrants: number;
  windowAction: WindowAction;
  capReached: boolean;
  capFreesInMs: number | null;
}

/**
 * One heartbeat's worth of accounting. Pure: every time input was measured by
 * Postgres, and the caller persists the result inside the same transaction
 * that read the inputs.
 */
export const computeAccrual = (
  input: AccrualInput,
  cfg: Omit<WatchRewardConfig, "amount">
): AccrualResult => {
  let { windowGrants, windowAgeMs } = input;
  let windowAction: WindowAction = "keep";

  // The window has run its 24 hours, so every slot is free again. Nothing runs
  // at the moment of reset; the first heartbeat afterwards clears it.
  if (windowAgeMs !== null && windowAgeMs >= cfg.capWindowMs) {
    windowGrants = 0;
    windowAgeMs = null;
    windowAction = "clear";
  }

  if (windowGrants >= cfg.cap) {
    // No banking: time watched while capped must not turn into instant
    // rewards the moment the window resets.
    return {
      creditedMs: 0,
      progressMs: 0,
      newGrants: 0,
      windowGrants,
      windowAction,
      capReached: true,
      capFreesInMs: Math.max(0, cfg.capWindowMs - (windowAgeMs ?? 0)),
    };
  }

  // The first beat (no clock) and a stale gap credit nothing. A negative gap
  // can only come from a lock wait between two near-simultaneous beats.
  const creditedMs =
    input.gapMs === null || input.gapMs > cfg.staleGapMs
      ? 0
      : Math.max(0, Math.min(input.gapMs, cfg.maxCreditPerBeatMs));

  const totalMs = input.progressMs + creditedMs;
  const newGrants = Math.min(
    Math.floor(totalMs / cfg.msPerReward),
    cfg.cap - windowGrants
  );
  let progressMs = totalMs - newGrants * cfg.msPerReward;

  if (newGrants > 0 && windowAgeMs === null) {
    windowAction = "open";
    windowAgeMs = 0;
  }

  const grantsAfter = windowGrants + newGrants;
  const capReached = grantsAfter >= cfg.cap;
  if (capReached) progressMs = 0;

  return {
    creditedMs,
    progressMs,
    newGrants,
    windowGrants: grantsAfter,
    windowAction,
    capReached,
    capFreesInMs: capReached
      ? Math.max(0, cfg.capWindowMs - (windowAgeMs ?? 0))
      : null,
  };
};
