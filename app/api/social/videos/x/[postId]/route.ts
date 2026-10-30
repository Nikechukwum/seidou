/**
 * Streams the video from an X post so it can play in a plain <video>, without
 * X's post embed (header, likes, replies) around it.
 *
 * Proxied rather than linked: video.twimg.com answers 403 to any request
 * carrying another site's Referer, and a <video> element cannot drop its
 * Referer. Range headers pass straight through, so seeking works and the
 * browser only pulls the bytes it plays.
 */

const SYNDICATION_URL = "https://cdn.syndication.twimg.com/tweet-result";

// The phone shell is max-w-md, so 720p is plenty and keeps the proxied
// bandwidth down; 1080p variants run ~10 Mbps.
const MAX_BITRATE = 2_500_000;

type Variant = { content_type: string; bitrate?: number; url: string };
type PostResult = {
  mediaDetails?: { type: string; video_info?: { variants?: Variant[] } }[];
};

/** The token X's own embed sends with this request, derived from the id. */
const syndicationToken = (postId: string) =>
  ((Number(postId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");

const resolveVideoUrl = async (postId: string): Promise<string | null> => {
  const response = await fetch(
    `${SYNDICATION_URL}?id=${postId}&token=${syndicationToken(postId)}`,
    // The MP4 address for a post does not change; skip X on most plays.
    { next: { revalidate: 60 * 60 * 24 } }
  );
  if (!response.ok) return null;

  const post = (await response.json()) as PostResult;
  const mp4s = (post.mediaDetails ?? [])
    .filter((media) => media.type === "video" || media.type === "animated_gif")
    .flatMap((media) => media.video_info?.variants ?? [])
    .filter((variant) => variant.content_type === "video/mp4")
    .sort((a, b) => (a.bitrate ?? 0) - (b.bitrate ?? 0));
  if (mp4s.length === 0) return null;

  const fitting = mp4s.filter((variant) => (variant.bitrate ?? 0) <= MAX_BITRATE);
  return (fitting.at(-1) ?? mp4s[0]).url;
};

const PASSTHROUGH_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "last-modified",
  "etag",
];

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) => {
  const { postId } = await params;
  if (!/^\d{1,25}$/.test(postId)) {
    return new Response("Invalid post id", { status: 400 });
  }

  const videoUrl = await resolveVideoUrl(postId);
  if (!videoUrl) {
    return new Response("No video in this post", { status: 404 });
  }

  const range = request.headers.get("range");
  const upstream = await fetch(videoUrl, {
    headers: range ? { range } : undefined,
    signal: request.signal,
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) {
    return new Response("Video unavailable", { status: 502 });
  }

  const headers = new Headers();
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("cache-control", "public, max-age=86400");

  return new Response(upstream.body, { status: upstream.status, headers });
};
