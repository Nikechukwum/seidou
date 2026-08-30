"use client";

import { createClient } from "@/lib/supabase/client";

export const SOCIAL_BUCKET = "social";

/**
 * Uploads an image to Supabase Storage from the browser, using the signed-in
 * user's own session.
 *
 * Deliberately not routed through the server: a service-role key would have to
 * exist in the app for that, and the file would be proxied twice. The bucket
 * policies (migration 0002) confine every write to a folder named after the
 * writer's user id, which is the real access control.
 *
 * Paths are deterministic and upserted, so replacing a thumbnail overwrites in
 * place and there is never a stale object to clean up. The trade-off is that
 * the URL does not change, so a cache-busting query string is appended —
 * without it browsers and the CDN keep serving the previous image.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export const thumbnailPath = (userId: string, videoId: string) =>
  `thumbnails/${userId}/${videoId}`;

export const bannerPath = (userId: string) => `banners/${userId}/banner`;

export interface UploadResult {
  url: string;
  key: string;
}

export const uploadSocialImage = async (
  file: File,
  path: string
): Promise<UploadResult> => {
  if (!ALLOWED.includes(file.type)) {
    throw new Error("Choose a JPEG, PNG or WebP image.");
  }

  if (file.size > MAX_BYTES) {
    throw new Error("Images must be 5MB or smaller.");
  }

  const supabase = createClient();

  const { error } = await supabase.storage
    .from(SOCIAL_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    throw new Error(error.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(SOCIAL_BUCKET).getPublicUrl(path);

  return { url: `${publicUrl}?v=${Date.now()}`, key: path };
};

export const deleteSocialImage = async (path: string) => {
  const supabase = createClient();
  await supabase.storage.from(SOCIAL_BUCKET).remove([path]);
};
