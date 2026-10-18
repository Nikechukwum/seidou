/**
 * Reading a saved YouTube channel page (Ctrl+S on the channel's Videos tab)
 * in the browser — step 1 of /import, ported from the standalone converter.
 * Client-only: it needs DOMParser.
 *
 * Chrome's "Save page as… complete" writes the HTML plus a "<page>_files"
 * folder, and rewrites every image to a local file in it. So the HTML gives
 * the channel's details and the FILE NAMES of its avatar and banner; the
 * images themselves are added from that folder.
 */

import { extractYoutubeId } from "./parse";

export interface ConvertedChannel {
  handle: string;
  name: string;
  subscribers: string | null;
  videoCount: string | null;
  sourceUrl: string | null;
  avatarFile: string | null;
  bannerFile: string | null;
  avatar: string | null;
  banner: string | null;
}

export interface FoundVideo {
  youtubeId: string;
  /** Title as it appears in the saved page — replaced by YouTube's own. */
  pageTitle: string;
}

/** Strips the durations, view counts and page chrome that ride along with link text. */
export const cleanVideoTitle = (title: string): string =>
  title
    .replace(/^\d+:\d+(:\d+)?/, "")
    .replace(/\d+\.?\d*[KM]?\s*views?.*$/i, "")
    .replace(/\d+\.?\s*$/, "")
    .replace(/YouTube.*$/i, "")
    .replace(/www\.youtube\.com.*$/i, "")
    .replace(/Share feedback.*$/i, "")
    .replace(/^\d+[\s.\-:)]+/, "")
    .replace(/\s+/g, " ")
    .trim();

/** Every video the saved page links to, once each, in page order. */
export const extractVideos = (doc: Document): FoundVideo[] => {
  const found = new Map<string, FoundVideo>();
  doc.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href") ?? "";
    let url = href;
    // The title link carries a title attribute; a thumbnail link only has
    // overlay text ("3:02:13 Now playing"), which is not a title at all.
    let title = link.getAttribute("title") || link.getAttribute("aria-label") || "";

    // Search-result pages wrap the real link: ...?rurl=<url>&tit=<title>
    if (href.includes("rurl=")) {
      try {
        url = decodeURIComponent(href.match(/rurl=([^&]+)/)?.[1] ?? "");
        title = decodeURIComponent((href.match(/tit=([^&]+)/)?.[1] ?? "").replace(/\+/g, " ")).replace(/<[^>]+>/g, "");
      } catch {
        return;
      }
    }

    if (!/watch\?|youtu\.be\//.test(url)) return;
    const youtubeId = extractYoutubeId(url.startsWith("/") ? `https://www.youtube.com${url}` : url);
    if (!youtubeId) return;

    const cleaned = cleanVideoTitle(title);
    const pageTitle = cleaned.length >= 3 ? cleaned : "";
    // A thumbnail link and a title link point at the same video: keep the
    // first position, but take the title from whichever link has one.
    const existing = found.get(youtubeId);
    if (!existing) found.set(youtubeId, { youtubeId, pageTitle });
    else if (!existing.pageTitle && pageTitle) existing.pageTitle = pageTitle;
  });

  return [...found.values()];
};

/** "./Zeltik - YouTube_files/unnamed(2).jpg" -> "unnamed(2).jpg" */
const fileNameFromSrc = (src: string | null | undefined): string | null => {
  if (!src || /^(https?:|data:)/i.test(src)) return null;
  const last = src.split(/[\/]/).pop()?.split(/[?#]/)[0];
  if (!last) return null;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

const textOf = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, " ").trim() || "";

/** The channel, from the saved page's header. Null when it is not a channel page. */
export const extractChannel = (doc: Document): ConvertedChannel | null => {
  const header = doc.querySelector("yt-page-header-view-model");
  const sourceUrl =
    doc.querySelector('link[rel="canonical"]')?.getAttribute("href") ||
    doc.documentElement.innerHTML.match(/saved from url=\(\d+\)(\S+)/)?.[1] ||
    null;

  const metadata = header
    ? Array.from(header.querySelectorAll(".ytContentMetadataViewModelMetadataText")).map(textOf).filter(Boolean)
    : [];

  const handle = metadata.find((t) => t.startsWith("@")) || sourceUrl?.match(/youtube\.com\/(@[^/?#]+)/)?.[1] || null;
  if (!handle) return null;

  return {
    handle,
    name: textOf(header?.querySelector("h1")) || doc.title.replace(/\s*-\s*YouTube\s*$/i, "").trim() || handle.slice(1),
    subscribers: metadata.find((t) => /subscriber/i.test(t)) || null,
    videoCount: metadata.find((t) => /\bvideos?\b/i.test(t)) || null,
    sourceUrl,
    avatarFile: fileNameFromSrc(
      header?.querySelector("yt-decorated-avatar-view-model img, yt-avatar-shape img")?.getAttribute("src")
    ),
    bannerFile: fileNameFromSrc(doc.querySelector("yt-image-banner-view-model img")?.getAttribute("src")),
    avatar: null,
    banner: null,
  };
};

export const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
