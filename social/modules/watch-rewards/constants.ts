/**
 * Watch-time loyalty rewards. Client-safe.
 *
 * The server reads the effective reward threshold and cap through
 * getWatchRewardConfig(), which can shorten them in local development only.
 */

/** Bidding currency per reward. Must match the "video" entry in supabase/loyalty_rewards_claim.sql. */
export const WATCH_REWARD_AMOUNT = 30_000;

/** Watch time that earns one reward. */
export const WATCH_REWARD_SECONDS_PER_REWARD = 300;

/** Rewards per window. */
export const WATCH_REWARD_CAP = 5;

/** A window opens with the first reward and fully resets this long afterwards. */
export const WATCH_REWARD_CAP_WINDOW_MS = 24 * 60 * 60 * 1000;

/** How often the player reports while a video is playing. */
export const WATCH_REWARD_HEARTBEAT_INTERVAL_MS = 15_000;

/** The most one heartbeat can credit, so short stalls count but long ones don't. */
export const WATCH_REWARD_MAX_CREDIT_PER_BEAT_MS = 20_000;

/** A longer gap between heartbeats credits nothing and restarts the clock. */
export const WATCH_REWARD_STALE_GAP_MS = 45_000;

/** Longest back-off after a failed heartbeat, in skipped ticks. */
export const WATCH_REWARD_MAX_BACKOFF_TICKS = 8;
