"use client";

import { useRef, useState } from "react";
import { FolderOpen, ImageIcon, Images, Trash2 } from "lucide-react";

import { trpc } from "@/social/trpc/client";
import { toast } from "@/social/lib/toast";

import {
  extractChannel,
  extractVideos,
  readAsDataUrl,
  type ConvertedChannel,
} from "../../lib/convert";
import { youtubeWatchUrl } from "../../lib/parse";

/** How many ids go to youtubeVideos.lookup per call (its maximum). */
const LOOKUP_CHUNK = 50;

const BUTTON = "rounded-full py-3 px-5 text-sm font-bold duration-100 disabled:opacity-40";
const BUTTON_PRIMARY = `${BUTTON} bg-black text-white active:bg-black/70`;
const BUTTON_BORDERED = `${BUTTON} border border-gray-200 text-black active:bg-black active:text-white`;
const SMALL_BUTTON =
  "flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold duration-100 active:bg-black active:text-white";
const FIELD = "w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-black";

interface ConvertedVideo {
  youtubeId: string;
  title: string;
  /** The channel YouTube reports for the video; null when the lookup failed. */
  author: string | null;
}

/** One saved channel page, read and looked up. */
interface ConvertedPage {
  key: string;
  fileName: string;
  /** The channel's name — read from the page, editable. */
  name: string;
  /** An app category NAME, so imported videos land on a real chip. */
  category: string | null;
  channel: ConvertedChannel | null;
  videos: ConvertedVideo[];
}

const normalise = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * A video belongs to another channel when YouTube's channel name and the
 * page's channel name do not contain each other — the old converter's rule.
 * Derived, not stored, so it follows the name if it is edited.
 */
const isUnrelated = (video: ConvertedVideo, pageName: string) => {
  if (!video.author) return false;
  const actual = normalise(video.author);
  const expected = normalise(pageName);
  return !!expected && !actual.includes(expected) && !expected.includes(actual);
};

/**
 * STEP 1 of /import — the converter that used to be a separate app.
 *
 *   1. Upload the saved channel page as Chrome named it (Ctrl+S on the
 *      channel's Videos tab). No renaming needed.
 *   2. Every linked video is looked up on YouTube for its real title and
 *      channel.
 *   3. On the page's card: check the channel name, pick the category from
 *      the app's own list, and add the avatar and banner from the "_files"
 *      folder saved beside the HTML.
 *   4. Continue to step 2 — the import preview.
 */
export const ConvertSection = ({
  onContinue,
  onSkip,
}: {
  /** Hands the finished export (as JSON text) to step 2. */
  onContinue: (exportText: string) => void;
  onSkip: () => void;
}) => {
  const htmlInput = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<ConvertedPage[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const categories = trpc.categories.getMany.useQuery();
  const categoryNames = (categories.data ?? []).map((c) => c.name).sort((a, b) => a.localeCompare(b));
  const lookup = trpc.youtubeVideos.lookup.useMutation();

  const updatePage = (key: string, change: Partial<ConvertedPage>) =>
    setPages((prev) => prev.map((p) => (p.key === key ? { ...p, ...change } : p)));

  const convertFile = async (file: File) => {
    const doc = new DOMParser().parseFromString(await file.text(), "text/html");
    const found = extractVideos(doc);
    const channel = extractChannel(doc);

    if (found.length === 0) {
      toast.error(`${file.name}: no YouTube videos found in this page`);
      return;
    }

    const videos: ConvertedVideo[] = [];
    setProgress({ done: 0, total: found.length });

    for (let start = 0; start < found.length; start += LOOKUP_CHUNK) {
      const chunk = found.slice(start, start + LOOKUP_CHUNK);
      let results: Awaited<ReturnType<typeof lookup.mutateAsync>> = {};
      try {
        results = await lookup.mutateAsync({ youtubeIds: chunk.map((v) => v.youtubeId) });
      } catch {
        // Lookup failed for the whole chunk: keep the titles from the page.
      }
      chunk.forEach(({ youtubeId, pageTitle }) => {
        const info = results[youtubeId];
        videos.push({
          youtubeId,
          title: info?.title || pageTitle || "Untitled video",
          author: info?.author ?? null,
        });
      });
      setProgress({ done: Math.min(start + chunk.length, found.length), total: found.length });
    }

    setPages((prev) => [
      ...prev,
      {
        key: `${file.name}-${Date.now()}`,
        fileName: file.name,
        name: channel?.name ?? file.name.replace(/\s*-\s*YouTube\.html?$/i, "").replace(/\.html?$/i, ""),
        category: null,
        channel,
        videos,
      },
    ]);
  };

  const onHtmlChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    for (const file of files) {
      try {
        await convertFile(file);
      } catch {
        toast.error(`${file.name}: could not read this page`);
      }
    }
    setProgress(null);
  };

  const incomplete = pages.some((p) => !p.category || !p.name.trim());
  const totalVideos = pages.reduce((n, p) => n + p.videos.length, 0);

  /** The finished library, in the export format step 2 reads. */
  const buildExport = () => {
    const channels = new Map<string, ConvertedChannel>();
    pages.forEach((p) => {
      if (!p.channel) return;
      const key = p.channel.handle.toLowerCase();
      const existing = channels.get(key);
      channels.set(key, {
        ...p.channel,
        name: p.name.trim(),
        avatar: p.channel.avatar ?? existing?.avatar ?? null,
        banner: p.channel.banner ?? existing?.banner ?? null,
      });
    });

    const videos = pages.flatMap((p) =>
      p.videos.map((v) => {
        const unrelated = isUnrelated(v, p.name);
        return {
          category: p.category ?? "",
          channelName: unrelated ? v.author ?? "" : p.name.trim(),
          videoUrl: youtubeWatchUrl(v.youtubeId),
          videoTitle: v.title,
          actualChannelName: v.author,
          isUnrelatedChannel: unrelated,
          // Unrelated videos belong to some other channel, not this one.
          channelHandle: unrelated ? null : p.channel?.handle ?? null,
        };
      })
    );

    return JSON.stringify({ version: 2, channels: [...channels.values()], videos });
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([buildExport()], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `video-library-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          Open the channel&apos;s Videos tab on YouTube, scroll to the bottom so every video loads, save it with Ctrl+S
          and upload the HTML here.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={BUTTON_PRIMARY}
            disabled={progress !== null}
            onClick={() => htmlInput.current?.click()}
          >
            {progress
              ? `Fetching ${progress.done} of ${progress.total}`
              : pages.length > 0
                ? "Add another page"
                : "Upload HTML"}
          </button>
          <button type="button" className={BUTTON_BORDERED} disabled={progress !== null} onClick={onSkip}>
            I have a JSON export
          </button>
          <input
            ref={htmlInput}
            type="file"
            accept=".html,.htm,text/html"
            multiple
            className="hidden"
            onChange={onHtmlChange}
          />
        </div>
      </div>

      {pages.map((page) => (
        <PageCard
          key={page.key}
          page={page}
          categoryNames={categoryNames}
          onChange={(change) => updatePage(page.key, change)}
          onRemove={() => setPages((prev) => prev.filter((p) => p.key !== page.key))}
        />
      ))}

      {pages.length > 0 && (
        <div className="space-y-2">
          {incomplete && <p className="text-sm text-amber-600">Give every page a name and a category to continue.</p>}
          <button
            type="button"
            className={`${BUTTON_PRIMARY} w-full`}
            disabled={incomplete || progress !== null || totalVideos === 0}
            onClick={() => onContinue(buildExport())}
          >
            Continue with {totalVideos.toLocaleString()} videos
          </button>
          <button
            type="button"
            className="w-full py-2 text-xs font-semibold text-gray-500 underline underline-offset-2 disabled:opacity-40"
            disabled={incomplete || progress !== null}
            onClick={download}
          >
            Download as JSON instead
          </button>
        </div>
      )}
    </div>
  );
};

/** One converted page: its channel, name, category, images and what was found. */
const PageCard = ({
  page,
  categoryNames,
  onChange,
  onRemove,
}: {
  page: ConvertedPage;
  categoryNames: string[];
  onChange: (change: Partial<ConvertedPage>) => void;
  onRemove: () => void;
}) => {
  const folderInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const { channel } = page;
  const unrelated = page.videos.filter((v) => isUnrelated(v, page.name)).length;
  const wanted = [channel?.avatarFile, channel?.bannerFile].filter(Boolean) as string[];
  const missing =
    (channel && !channel.avatar && channel.avatarFile ? 1 : 0) + (channel && !channel.banner && channel.bannerFile ? 1 : 0);

  const addImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!channel || files.length === 0) return;

    const find = (name: string | null) => (name ? files.find((f) => f.name === name) : undefined);
    const avatarFile = find(channel.avatarFile);
    const bannerFile = find(channel.bannerFile);
    if (!avatarFile && !bannerFile) {
      toast.error(`Looking for ${wanted.join(" and ")} — pick the "_files" folder saved with this page`);
      return;
    }
    onChange({
      channel: {
        ...channel,
        avatar: avatarFile ? await readAsDataUrl(avatarFile) : channel.avatar,
        banner: bannerFile ? await readAsDataUrl(bannerFile) : channel.banner,
      },
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      {channel && (
        <div className="h-16 bg-gray-100">
          {channel.banner ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={channel.banner} alt="" className="h-full w-full object-cover" />
          ) : (
            <p className="flex h-full items-center justify-center text-xs text-gray-400">
              {channel.bannerFile ? "Banner not added" : "No banner on this page"}
            </p>
          )}
        </div>
      )}

      <div className="flex items-start gap-3 px-3 pt-3">
        {channel && (
          <div className="-mt-9 size-12 shrink-0 overflow-hidden rounded-full border-4 border-white bg-gray-100">
            {channel.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={channel.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <ImageIcon className="size-4 text-gray-400" />
              </div>
            )}
          </div>
        )}
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {[channel?.handle, channel?.subscribers, `${page.videos.length} found`, unrelated && `${unrelated} from other channels`]
            .filter(Boolean)
            .join(" • ")}
        </p>
        <button type="button" aria-label="Remove this page" onClick={onRemove} className="p-1 text-gray-400 active:text-red-600">
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="space-y-3 px-3 py-3">
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-gray-600">Channel name</span>
          <input
            value={page.name}
            onChange={(event) => onChange({ name: event.target.value })}
            className={`${FIELD} ${page.name.trim() ? "border-gray-200" : "border-amber-400"}`}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-gray-600">Category</span>
          <select
            value={page.category ?? ""}
            onChange={(event) => onChange({ category: event.target.value || null })}
            className={`${FIELD} bg-white ${page.category ? "border-gray-200" : "border-amber-400"}`}
          >
            <option value="">Choose a category</option>
            {categoryNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        {channel && wanted.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className={`mr-auto text-xs ${missing ? "text-amber-600" : "text-gray-500"}`}>
              {missing ? `${missing} image${missing > 1 ? "s" : ""} to add` : "Images added"}
            </span>
            <button type="button" className={SMALL_BUTTON} onClick={() => folderInput.current?.click()}>
              <FolderOpen className="size-3.5" />
              Add folder
            </button>
            <button type="button" className={SMALL_BUTTON} onClick={() => filesInput.current?.click()}>
              <Images className="size-3.5" />
              Pick files
            </button>
            <input
              ref={folderInput}
              type="file"
              className="hidden"
              onChange={addImages}
              // the whole "<page name>_files" folder
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            />
            <input ref={filesInput} type="file" accept="image/*" multiple className="hidden" onChange={addImages} />
          </div>
        )}
        {!channel && (
          <p className="text-xs text-amber-600">No channel header in this page, so its videos import without a channel.</p>
        )}
      </div>
    </div>
  );
};
