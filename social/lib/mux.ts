import "server-only";
import Mux from "@mux/mux-node";

/**
 * Constructed on first use, not at module load.
 *
 * The Mux SDK throws from its constructor when the credentials are missing.
 * Building this file eagerly meant `next build` failed outright whenever
 * MUX_TOKEN_ID was unset — including on machines that only touch the feed and
 * never upload anything. Deferring it keeps the app buildable and runnable
 * without Mux configured; only the upload and playback-sync paths fail, with
 * a message that says what is missing.
 */
let client: Mux | null = null;

export const getMux = (): Mux => {
  if (client) return client;

  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    throw new Error(
      "MUX_TOKEN_ID and MUX_TOKEN_SECRET must be set to upload or sync videos. Add them to .env.local from your Mux dashboard."
    );
  }

  client = new Mux({ tokenId, tokenSecret });
  return client;
};
