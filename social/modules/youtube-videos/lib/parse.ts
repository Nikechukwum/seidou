import { z } from "zod";

/**
 * Parsing and validation for the YouTube library import. Client-safe.
 *
 * Shared by the import page (which parses the pasted export and builds the
 * preview) and the server (which re-validates every row it is sent), so there
 * is one definition of what a valid row is and one way to read a video id.
 */

/** Rows per importBatch call. Each batch is one atomic INSERT. */
export const IMPORT_BATCH_SIZE = 200;

/** Upper bounds on one export, so a wrong file fails fast instead of freezing the tab. */
export const IMPORT_MAX_ROWS = 20_000;
/** Room for a few channels' avatar and banner embedded as data URLs. */
export const IMPORT_MAX_CHARS = 15 * 1024 * 1024;
/** Per image, after decoding — the `social` bucket's own ceiling. */
export const CHANNEL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const CHANNEL_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** What the export tool writes when it could not find a real value. */
const PLACEHOLDER_CATEGORY = "uncategorized";
const PLACEHOLDER_CHANNEL = "unknown channel";
const PLACEHOLDER_TITLE = "untitled video";

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = ["youtube.com", "youtube-nocookie.com"];

/**
 * The 11-character video id from any of the URL shapes YouTube hands out —
 * watch?v=, youtu.be/, /shorts/, /embed/, /live/ — with or without extra
 * query parameters. A bare id is accepted too. Returns null for anything else.
 */
export const extractYoutubeId = (input: string): string | null => {
  const value = input.trim();
  if (YOUTUBE_ID_PATTERN.test(value)) return value;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  let candidate: string | null = null;

  if (host === "youtu.be") {
    candidate = url.pathname.split("/")[1] ?? null;
  } else if (YOUTUBE_HOSTS.includes(host)) {
    candidate =
      url.searchParams.get("v") ??
      url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/)?.[1] ??
      null;
  }

  return candidate && YOUTUBE_ID_PATTERN.test(candidate) ? candidate : null;
};

export const youtubeWatchUrl = (youtubeId: string) =>
  `https://www.youtube.com/watch?v=${youtubeId}`;

/** 320x180, the only default size that is 16:9 without letterbox bars. */
export const youtubeThumbnailUrl = (youtubeId: string) =>
  `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`;

export const youtubeEmbedUrl = (youtubeId: string) =>
  `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&playsinline=1`;

/**
 * "@Zeltik" / "zeltik" -> "@zeltik". YouTube handles are case-insensitive, so
 * the lowercase form is the identity. Null when it cannot be a handle.
 */
export const normalizeHandle = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim().replace(/^@/, "").toLowerCase() ?? "";
  if (!trimmed || trimmed.length > 100 || /[\s/?#]/.test(trimmed)) return null;
  return `@${trimmed}`;
};

export const channelHandleSchema = z
  .string()
  .regex(/^@[^\sA-Z/?#]{1,100}$/, "Not a channel handle");

/** One row as the import sends it to the server and the server stores it. */
export const youtubeImportRowSchema = z.object({
  youtubeId: z.string().regex(YOUTUBE_ID_PATTERN, "Not a YouTube video id"),
  title: z.string().trim().min(1).max(500),
  category: z.string().trim().min(1).max(200).nullable(),
  channelName: z.string().trim().min(1).max(200).nullable(),
  actualChannelName: z.string().trim().min(1).max(200).nullable(),
  isUnrelatedChannel: z.boolean(),
  /** Links the video to a channel sent with the same import. */
  channelHandle: channelHandleSchema.nullable().default(null),
});

export type YoutubeImportRow = z.infer<typeof youtubeImportRowSchema>;

/** One row as the export tool writes it. The last two fields are optional. */
const exportRowSchema = z.object({
  category: z.string(),
  channelName: z.string(),
  videoUrl: z.string(),
  videoTitle: z.string(),
  actualChannelName: z.string().nullish(),
  isUnrelatedChannel: z.boolean().nullish(),
  channelHandle: z.string().nullish(),
});

/** One channel as the converter writes it (version 2 exports). */
const exportChannelSchema = z.object({
  handle: z.string(),
  name: z.string().nullish(),
  subscribers: z.string().nullish(),
  videoCount: z.string().nullish(),
  sourceUrl: z.string().nullish(),
  avatar: z.string().nullish(),
  banner: z.string().nullish(),
});

/** An embedded image, decoded far enough to check it before it is uploaded. */
export interface ChannelImage {
  dataUrl: string;
  type: (typeof CHANNEL_IMAGE_TYPES)[number];
  bytes: number;
}

/** A channel ready to import: its details, plus the images still to upload. */
export interface ParsedChannel {
  handle: string;
  name: string;
  subscribersText: string | null;
  videoCountText: string | null;
  sourceUrl: string | null;
  avatar: ChannelImage | null;
  banner: ChannelImage | null;
  /** Why an image that was in the file is not being used. */
  imageProblems: string[];
}

/** What the server stores for a channel once its images are uploaded. */
export const youtubeChannelInputSchema = z.object({
  handle: channelHandleSchema,
  name: z.string().trim().min(1).max(200),
  subscribersText: z.string().trim().min(1).max(100).nullable(),
  videoCountText: z.string().trim().min(1).max(100).nullable(),
  sourceUrl: z.string().trim().url().max(500).nullable(),
  avatar: z.object({ url: z.string().url().max(1000), key: z.string().min(1).max(300) }).nullable(),
  banner: z.object({ url: z.string().url().max(1000), key: z.string().min(1).max(300) }).nullable(),
});

export type YoutubeChannelInput = z.infer<typeof youtubeChannelInputSchema>;

/** Checks an embedded data URL: an allowed image type, inside the size limit. */
const readChannelImage = (
  value: string | null | undefined,
  label: string,
  problems: string[]
): ChannelImage | null => {
  if (!value) return null;
  const match = value.match(/^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) {
    problems.push(`${label} is not an embedded image`);
    return null;
  }
  const type = match[1].toLowerCase();
  if (!(CHANNEL_IMAGE_TYPES as readonly string[]).includes(type)) {
    problems.push(`${label} is ${type}; use JPEG, PNG or WebP`);
    return null;
  }
  const base64 = match[2].replace(/\s/g, "");
  const bytes = Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  if (bytes > CHANNEL_IMAGE_MAX_BYTES) {
    problems.push(`${label} is larger than 5 MB`);
    return null;
  }
  return { dataUrl: value, type: type as ChannelImage["type"], bytes };
};

const parseChannels = (raw: unknown): ParsedChannel[] => {
  if (!Array.isArray(raw)) return [];
  const byHandle = new Map<string, ParsedChannel>();
  raw.forEach((item) => {
    const parsed = exportChannelSchema.safeParse(item);
    if (!parsed.success) return;
    const handle = normalizeHandle(parsed.data.handle);
    if (!handle) return;
    const problems: string[] = [];
    const text = (v: string | null | undefined, max: number) => {
      const t = v?.trim() ?? "";
      return t ? t.slice(0, max) : null;
    };
    const sourceUrl = text(parsed.data.sourceUrl, 500);
    byHandle.set(handle, {
      handle,
      name: text(parsed.data.name, 200) ?? handle.slice(1),
      subscribersText: text(parsed.data.subscribers, 100),
      videoCountText: text(parsed.data.videoCount, 100),
      sourceUrl: sourceUrl && /^https?:\/\//i.test(sourceUrl) ? sourceUrl : null,
      avatar: readChannelImage(parsed.data.avatar, "Avatar", problems),
      banner: readChannelImage(parsed.data.banner, "Banner", problems),
      imageProblems: problems,
    });
  });
  return [...byHandle.values()];
};

export interface InvalidExportRow {
  /** 1-based position in the pasted array. */
  row: number;
  reason: string;
  label: string;
}

export type ParsedExport =
  | { ok: false; error: string }
  | {
      ok: true;
      total: number;
      /** Valid rows, one per video id. */
      rows: YoutubeImportRow[];
      /** Channels in the file (version 2 exports). Empty for older exports. */
      channels: ParsedChannel[];
      invalid: InvalidExportRow[];
      /** Rows dropped because an earlier row in the same file had the same id. */
      duplicates: number;
      placeholderTitles: number;
      unrelated: number;
    };

/** Trims, and turns an empty string or the tool's placeholder into null. */
const clean = (value: string | null | undefined, placeholder: string) => {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" || trimmed.toLowerCase() === placeholder
    ? null
    : trimmed;
};

const describeRow = (raw: unknown) => {
  if (raw && typeof raw === "object") {
    const { videoTitle, videoUrl } = raw as Record<string, unknown>;
    if (typeof videoTitle === "string" && videoTitle.trim()) return videoTitle;
    if (typeof videoUrl === "string" && videoUrl.trim()) return videoUrl;
  }
  return "(unreadable row)";
};

/**
 * Turns the pasted export into rows ready to send, plus everything the preview
 * needs to explain what was left out and why. Never throws: a file that cannot
 * be used at all comes back as { ok: false }.
 */
export const parseExport = (text: string): ParsedExport => {
  if (!text.trim()) {
    return { ok: false, error: "Paste the exported JSON or choose a file." };
  }

  if (text.length > IMPORT_MAX_CHARS) {
    return { ok: false, error: "That is larger than 5 MB. Split the export." };
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "That is not valid JSON." };
  }

  // Version 2 exports are { channels, videos }; older ones a bare array.
  let channels: ParsedChannel[] = [];
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const library = data as { channels?: unknown; videos?: unknown };
    if (!Array.isArray(library.videos)) {
      return { ok: false, error: "Expected a JSON array of videos, or { channels, videos }." };
    }
    channels = parseChannels(library.channels);
    data = library.videos;
  }

  if (!Array.isArray(data)) {
    return { ok: false, error: "Expected a JSON array of videos." };
  }

  if (data.length === 0) {
    return { ok: false, error: "The array is empty." };
  }

  if (data.length > IMPORT_MAX_ROWS) {
    return {
      ok: false,
      error: `That is more than ${IMPORT_MAX_ROWS.toLocaleString()} rows. Split the export.`,
    };
  }

  const rows: YoutubeImportRow[] = [];
  const invalid: InvalidExportRow[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  data.forEach((raw, index) => {
    const reject = (reason: string) =>
      invalid.push({ row: index + 1, reason, label: describeRow(raw) });

    const parsed = exportRowSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue.path.join(".");
      return reject(field ? `${field}: ${issue.message}` : issue.message);
    }

    const youtubeId = extractYoutubeId(parsed.data.videoUrl);
    if (!youtubeId) return reject("videoUrl has no YouTube video id");

    const row = youtubeImportRowSchema.safeParse({
      youtubeId,
      title: parsed.data.videoTitle,
      category: clean(parsed.data.category, PLACEHOLDER_CATEGORY),
      channelName: clean(parsed.data.channelName, PLACEHOLDER_CHANNEL),
      actualChannelName: clean(
        parsed.data.actualChannelName,
        PLACEHOLDER_CHANNEL
      ),
      isUnrelatedChannel: parsed.data.isUnrelatedChannel ?? false,
      // Only linked when the channel itself came with the file.
      channelHandle: (() => {
        const handle = normalizeHandle(parsed.data.channelHandle);
        return handle && channels.some((c) => c.handle === handle) ? handle : null;
      })(),
    });

    if (!row.success) {
      const issue = row.error.issues[0];
      return reject(`${issue.path.join(".")}: ${issue.message}`);
    }

    // First occurrence wins.
    if (seen.has(youtubeId)) {
      duplicates += 1;
      return;
    }

    seen.add(youtubeId);
    rows.push(row.data);
  });

  return {
    ok: true,
    total: data.length,
    rows,
    channels,
    invalid,
    duplicates,
    placeholderTitles: rows.filter(
      (row) => row.title.toLowerCase() === PLACEHOLDER_TITLE
    ).length,
    unrelated: rows.filter((row) => row.isUnrelatedChannel).length,
  };
};
