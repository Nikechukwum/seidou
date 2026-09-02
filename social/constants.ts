export const DEFAULT_LIMIT = 5;

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Seidou Social is mounted inside the App Center rather than at the site root,
 * so every link the ported code inherited from the standalone clone
 * (`/videos/…`, `/studio`, `/users/…`) has to be prefixed.
 *
 * Always route through these helpers instead of hard-coding the base — it is
 * the one place to change if the mount point ever moves.
 */
export const SOCIAL_BASE = "/app-center/apps/seidou-social";

export const socialPath = (path: string = "") => `${SOCIAL_BASE}${path}`;

/** Absolute URL — for share links and anything leaving the browser. */
export const socialUrl = (path: string = "") =>
  new URL(socialPath(path), APP_URL).toString();
