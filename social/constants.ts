export const DEFAULT_LIMIT = 5;

/**
 * This app's origin, e.g. "https://seidou.example".
 *
 * In the browser it is always the page's own origin, so links are right on
 * every deployment (localhost, Vercel previews, custom domains) with nothing
 * to configure. The server has no page, so it falls back through
 * NEXT_PUBLIC_APP_URL (set it to pin one address), then the production domain
 * Vercel sets automatically, then the deployment's own domain, then local dev.
 *
 * A function rather than a constant: `window` does not exist when this module
 * is first evaluated on the server, and a constant froze the localhost
 * fallback into every share link on deployments without the variable set.
 */
export const getAppUrl = () => {
  if (typeof window !== "undefined") return window.location.origin;

  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
};

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

/**
 * Absolute URL — for share links and anything leaving the browser.
 *
 * Call it when the link is used (a click handler, an effect), not while
 * rendering: during server rendering it can only guess the address, and the
 * browser would then render different text.
 */
export const socialUrl = (path: string = "") =>
  new URL(socialPath(path), getAppUrl()).toString();
