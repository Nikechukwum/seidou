import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import {
  VideoAssetCreatedWebhookEvent,
  VideoAssetErroredWebhookEvent,
  VideoAssetReadyWebhookEvent,
  VideoAssetTrackReadyWebhookEvent,
  VideoAssetDeletedWebhookEvent,
} from "@mux/mux-node/resources/webhooks";

import { db } from "@/social/db";
import { getMux } from "@/social/lib/mux";
import { videos } from "@/social/db/schema";

/**
 * Mux calls this as an upload moves through transcoding. It is the only way
 * the app learns that a video is playable — nothing polls.
 *
 * Point Mux at <public-url>/api/social/videos/webhook. In development that
 * means a tunnel, e.g. `ngrok http 3000`.
 */

const SIGNING_SECRET = process.env.MUX_WEBHOOK_SECRET!;

type WebhookEvent =
  | VideoAssetCreatedWebhookEvent
  | VideoAssetReadyWebhookEvent
  | VideoAssetErroredWebhookEvent
  | VideoAssetTrackReadyWebhookEvent
  | VideoAssetDeletedWebhookEvent;

export const POST = async (request: Request) => {
  if (!SIGNING_SECRET) {
    throw new Error("MUX_WEBHOOK_SECRET is not set");
  }

  const headersPayload = await headers();
  const muxSignature = headersPayload.get("mux-signature");

  if (!muxSignature) {
    return new Response("No signature found", { status: 401 });
  }

  const payload = await request.json();
  const body = JSON.stringify(payload);

  // Throws if the signature does not match, which is what stops anyone from
  // POSTing here and marking arbitrary videos ready.
  getMux().webhooks.verifySignature(
    body,
    { "mux-signature": muxSignature },
    SIGNING_SECRET
  );

  switch (payload.type as WebhookEvent["type"]) {
    case "video.asset.created": {
      const data = payload.data as VideoAssetCreatedWebhookEvent["data"];

      if (!data.upload_id) {
        return new Response("No upload ID found", { status: 400 });
      }

      await db
        .update(videos)
        .set({
          muxAssetId: data.id,
          muxStatus: data.status,
        })
        .where(eq(videos.muxUploadId, data.upload_id));
      break;
    }

    case "video.asset.ready": {
      const data = payload.data as VideoAssetReadyWebhookEvent["data"];
      const playbackId = data.playback_ids?.[0].id;

      if (!data.upload_id) {
        return new Response("Missing upload ID", { status: 400 });
      }

      if (!playbackId) {
        return new Response("Missing playback ID", { status: 400 });
      }

      /**
       * Upstream copied both images into UploadThing here. We reference the
       * Mux URLs directly instead: it removes a vendor, drops a couple of
       * seconds of file copying from the webhook's critical path, and every
       * consumer already reads thumbnailUrl/previewUrl so nothing downstream
       * changes.
       *
       * thumbnailKey/previewKey stay null and now mean "a custom image the
       * user uploaded to Supabase Storage" — set only in M8.
       */
      const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
      const previewUrl = `https://image.mux.com/${playbackId}/animated.gif`;
      const duration = data.duration ? Math.round(data.duration * 1000) : 0;

      await db
        .update(videos)
        .set({
          muxStatus: data.status,
          muxPlaybackId: playbackId,
          muxAssetId: data.id,
          thumbnailUrl,
          previewUrl,
          duration,
        })
        .where(eq(videos.muxUploadId, data.upload_id));
      break;
    }

    case "video.asset.errored": {
      const data = payload.data as VideoAssetErroredWebhookEvent["data"];

      if (!data.upload_id) {
        return new Response("Missing upload ID", { status: 400 });
      }

      await db
        .update(videos)
        .set({ muxStatus: data.status })
        .where(eq(videos.muxUploadId, data.upload_id));
      break;
    }

    case "video.asset.deleted": {
      const data = payload.data as VideoAssetDeletedWebhookEvent["data"];

      if (!data.upload_id) {
        return new Response("Missing upload ID", { status: 400 });
      }

      await db.delete(videos).where(eq(videos.muxUploadId, data.upload_id));
      break;
    }

    case "video.asset.track.ready": {
      // The SDK's type omits asset_id, though Mux does send it.
      const data = payload.data as VideoAssetTrackReadyWebhookEvent["data"] & {
        asset_id: string;
      };

      const assetId = data.asset_id;

      if (!assetId) {
        return new Response("Missing asset ID", { status: 400 });
      }

      await db
        .update(videos)
        .set({
          muxTrackId: data.id,
          muxTrackStatus: data.status,
        })
        .where(eq(videos.muxAssetId, assetId));
      break;
    }
  }

  return new Response("Webhook received", { status: 200 });
};
