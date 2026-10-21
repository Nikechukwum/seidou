import assert from "node:assert/strict";
import { test } from "node:test";

import {
  extractYoutubeId,
  parseExport,
} from "@/social/modules/youtube-videos/lib/parse";

/**
 * Checks for the YouTube import's parsing rules. No database, no network.
 *
 * Run with: npm run social:test-import
 */

const ID = "dQw4w9WgXcQ";

const row = (overrides: Record<string, unknown> = {}) => ({
  category: "Woodworking",
  channelName: "Some Channel",
  videoUrl: `https://www.youtube.com/watch?v=${ID}`,
  videoTitle: "A real title",
  ...overrides,
});

const parse = (rows: unknown) => {
  const result = parseExport(JSON.stringify(rows));
  assert.ok(result.ok, "expected the export to parse");
  return result;
};

test("reads the id from every URL shape", () => {
  const urls = [
    `https://www.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/watch?feature=share&v=${ID}&t=42s`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc123`,
    `youtu.be/${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}?autoplay=1`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `  ${ID}  `,
  ];

  for (const url of urls) assert.equal(extractYoutubeId(url), ID, url);
});

test("rejects URLs with no usable id", () => {
  const urls = [
    "",
    "not a url",
    "https://www.youtube.com/watch?v=tooshort",
    "https://www.youtube.com/@somechannel",
    `https://vimeo.com/${ID}`,
    `https://notyoutube.com/watch?v=${ID}`,
  ];

  for (const url of urls) assert.equal(extractYoutubeId(url), null, url);
});

test("optional fields may be missing", () => {
  const result = parse([row()]);

  assert.deepEqual(result.rows, [
    {
      youtubeId: ID,
      title: "A real title",
      category: "Woodworking",
      channelName: "Some Channel",
      actualChannelName: null,
      isUnrelatedChannel: false,
      channelHandle: null,
    },
  ]);
});

test("placeholders become null, but a placeholder title is kept and counted", () => {
  const result = parse([
    row({
      category: "Uncategorized",
      channelName: "Unknown Channel",
      videoTitle: "Untitled Video",
    }),
  ]);

  assert.equal(result.rows[0].category, null);
  assert.equal(result.rows[0].channelName, null);
  assert.equal(result.rows[0].title, "Untitled Video");
  assert.equal(result.placeholderTitles, 1);
});

test("the same video twice in a file is kept once, first wins", () => {
  const result = parse([
    row({ videoTitle: "First" }),
    row({ videoUrl: `https://youtu.be/${ID}?si=x`, videoTitle: "Second" }),
  ]);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].title, "First");
  assert.equal(result.duplicates, 1);
});

test("malformed rows are reported with their position, good rows survive", () => {
  const result = parse([
    row(),
    row({ videoUrl: "https://example.com/nothing" }),
    { category: "x", channelName: "y", videoUrl: `https://youtu.be/${ID}` },
    "not an object",
    row({ videoUrl: "https://youtu.be/AAAAAAAAAAA", videoTitle: "   " }),
  ]);

  assert.equal(result.rows.length, 1);
  assert.deepEqual(
    result.invalid.map((entry) => entry.row),
    [2, 3, 4, 5]
  );
  assert.match(result.invalid[0].reason, /no YouTube video id/);
  assert.match(result.invalid[1].reason, /videoTitle/);
  assert.match(result.invalid[3].reason, /title/);
});

test("unrelated-channel rows are kept and counted, for the page to filter", () => {
  const result = parse([
    row({ isUnrelatedChannel: true, actualChannelName: "Someone Else" }),
  ]);

  assert.equal(result.unrelated, 1);
  assert.equal(result.rows[0].isUnrelatedChannel, true);
  assert.equal(result.rows[0].actualChannelName, "Someone Else");
});

test("input that is not a usable export is refused, not thrown", () => {
  for (const text of ["", "{not json", "{}", "[]"]) {
    assert.equal(parseExport(text).ok, false, text);
  }
});

// --- Version 2 exports: { channels, videos } --------------------------------

// A 1x1 transparent PNG.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const channel = (overrides: Record<string, unknown> = {}) => ({
  handle: "@Zeltik",
  name: "Zeltik",
  subscribers: "890K subscribers",
  videoCount: "458 videos",
  sourceUrl: "https://www.youtube.com/@Zeltik/videos",
  avatar: PNG,
  banner: null,
  ...overrides,
});

test("a version 2 export carries its channels, handle normalised", () => {
  const result = parse({ version: 2, channels: [channel()], videos: [row({ channelHandle: "@Zeltik" })] });
  assert.equal(result.channels.length, 1);
  assert.equal(result.channels[0].handle, "@zeltik");
  assert.equal(result.channels[0].avatar?.type, "image/png");
  assert.equal(result.channels[0].banner, null);
  assert.equal(result.rows[0].channelHandle, "@zeltik");
});

test("a video only links to a channel that came with the file", () => {
  const result = parse({ version: 2, channels: [channel()], videos: [row({ channelHandle: "@someoneelse" })] });
  assert.equal(result.rows[0].channelHandle, null);
});

test("an embedded image that is not JPEG/PNG/WebP is dropped and explained", () => {
  const result = parse({ version: 2, channels: [channel({ avatar: "data:image/gif;base64,R0lGOD==" })], videos: [row()] });
  assert.equal(result.channels[0].avatar, null);
  assert.match(result.channels[0].imageProblems[0], /image\/gif/);
});

test("older bare-array exports still import, with no channels", () => {
  const result = parse([row()]);
  assert.equal(result.channels.length, 0);
  assert.equal(result.rows[0].channelHandle, null);
});
