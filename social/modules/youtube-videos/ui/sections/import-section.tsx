"use client";

import { useRef, useState } from "react";

import { trpc } from "@/social/trpc/client";
import { toast } from "@/social/lib/toast";
import { uploadSocialImage, type UploadResult } from "@/social/lib/storage";
import { createClient } from "@/lib/supabase/client";

import {
  IMPORT_BATCH_SIZE,
  IMPORT_MAX_CHARS,
  parseExport,
  type ChannelImage,
  type ParsedChannel,
  type ParsedExport,
  type YoutubeImportRow,
} from "../../lib/parse";

/**
 * Where a channel's images go in the `social` bucket. The second segment must
 * be the uploader's own user id — that is what the bucket policies (0002)
 * allow a signed-in user to write.
 */
const channelImagePath = (userId: string, handle: string, kind: "avatar" | "banner") =>
  `youtube-channels/${userId}/${handle.slice(1).replace(/[^a-z0-9._-]/g, "-")}/${kind}`;

const uploadChannelImage = async (image: ChannelImage, path: string): Promise<UploadResult> => {
  const blob = await (await fetch(image.dataUrl)).blob();
  const file = new File([blob], path.split("/").pop() ?? "image", { type: image.type });
  return uploadSocialImage(file, path);
};

/** Banner strip, avatar, name and counts — how the channel will be stored. */
const ChannelPreview = ({ channel }: { channel: ParsedChannel }) => (
  <div className="overflow-hidden rounded-xl border border-gray-200">
    <div className="h-16 bg-gray-100">
      {channel.banner && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={channel.banner.dataUrl} alt="" className="h-full w-full object-cover" />
      )}
    </div>
    <div className="flex items-start gap-3 px-3 pb-3">
      <div className="-mt-6 size-12 shrink-0 overflow-hidden rounded-full border-4 border-white bg-gray-100">
        {channel.avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.avatar.dataUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1 pt-1.5">
        <p className="truncate text-sm font-bold">{channel.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[channel.handle, channel.subscribersText, channel.videoCountText].filter(Boolean).join(" • ")}
        </p>
        {(!channel.avatar || !channel.banner) && (
          <p className="mt-1 text-xs text-amber-600">
            {[!channel.avatar && "No avatar", !channel.banner && "No banner"].filter(Boolean).join(", ")} in the file
          </p>
        )}
        {channel.imageProblems.map((problem) => (
          <p key={problem} className="mt-1 text-xs text-red-600">
            {problem}
          </p>
        ))}
      </div>
    </div>
  </div>
);

/** Rows shown in the preview and in each result list before "and N more". */
const LIST_LIMIT = 20;

interface FailedRow {
  label: string;
  reason: string;
  /** Set when the whole batch failed, so the row can be sent again safely. */
  retry?: YoutubeImportRow;
}

interface ImportResult {
  inserted: number;
  skipped: number;
  failed: FailedRow[];
  /** Channels saved, and the ones that could not be (their videos import unlinked). */
  channelsSaved: number;
  channelsFailed: { handle: string; reason: string }[];
}

const BUTTON =
  "rounded-full py-3 px-5 text-sm font-bold duration-100 disabled:opacity-40";
const BUTTON_PRIMARY = `${BUTTON} bg-black text-white active:bg-black/70`;
const BUTTON_BORDERED = `${BUTTON} border border-gray-200 text-black active:bg-black active:text-white`;

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-xl border border-gray-200 px-3 py-2">
    <p className="text-lg font-bold">{value.toLocaleString()}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

const More = ({ count }: { count: number }) =>
  count > LIST_LIMIT ? (
    <p className="text-xs text-muted-foreground">
      and {(count - LIST_LIMIT).toLocaleString()} more
    </p>
  ) : null;

/**
 * Paste or load an export, see exactly what would be written, then write it.
 *
 * Nothing reaches the server until "Import" is pressed. The rows then go up in
 * batches, one after another; a batch that fails is recorded and the rest
 * carry on, so one bad request does not cost the whole import.
 */
export const ImportSection = ({
  convertedText,
  onBack,
}: {
  /** The export built by step 1. When set, the paste box is replaced by it. */
  convertedText?: string;
  /** Back to step 1. */
  onBack?: () => void;
} = {}) => {
  const utils = trpc.useUtils();
  const fileInput = useRef<HTMLInputElement>(null);

  const [text, setText] = useState(convertedText ?? "");
  const [parsed, setParsed] = useState<ParsedExport | null>(() =>
    convertedText ? parseExport(convertedText) : null
  );
  const [includeUnrelated, setIncludeUnrelated] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const importBatch = trpc.youtubeVideos.importBatch.useMutation();
  const upsertChannel = trpc.youtubeVideos.upsertChannel.useMutation();
  const isImporting = progress !== null;

  const preview = (value: string) => {
    setResult(null);
    setParsed(parseExport(value));
  };

  const onTextChange = (value: string) => {
    setText(value);
    // The preview describes the previous text, so it no longer applies.
    setParsed(null);
    setResult(null);
  };

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again still fires a change event.
    event.target.value = "";
    if (!file) return;

    if (file.size > IMPORT_MAX_CHARS) {
      setParsed({ ok: false, error: "That file is larger than 15 MB. Split the export." });
      return;
    }

    const value = await file.text();
    setText(value);
    preview(value);
  };

  const retryable = (result?.failed ?? []).flatMap((row) => row.retry ?? []);

  const rowsToImport =
    parsed?.ok
      ? parsed.rows.filter((row) => includeUnrelated || !row.isUnrelatedChannel)
      : [];

  /**
   * `previous` carries the totals of an earlier run when retrying, so the
   * result reads as one import rather than restarting from zero.
   */
  const runImport = async (rows: YoutubeImportRow[], previous?: ImportResult, channels: ParsedChannel[] = []) => {
    const next: ImportResult = {
      inserted: previous?.inserted ?? 0,
      skipped: previous?.skipped ?? 0,
      // Batch failures are being retried now; row-level rejections stand.
      failed: previous?.failed.filter((row) => !row.retry) ?? [],
      channelsSaved: previous?.channelsSaved ?? 0,
      channelsFailed: previous?.channelsFailed ?? [],
    };

    setResult(null);
    setProgress({ done: 0, total: rows.length });

    // Channels first: upload each one's avatar and banner to the bucket, then
    // save the channel, so the videos below have a row to link to.
    if (channels.length > 0) {
      const { data } = await createClient().auth.getUser();
      const userId = data.user?.id;
      for (const channel of channels) {
        try {
          if (!userId) throw new Error("Sign in again to upload the channel images.");
          const [avatar, banner] = await Promise.all([
            channel.avatar ? uploadChannelImage(channel.avatar, channelImagePath(userId, channel.handle, "avatar")) : null,
            channel.banner ? uploadChannelImage(channel.banner, channelImagePath(userId, channel.handle, "banner")) : null,
          ]);
          await upsertChannel.mutateAsync({
            handle: channel.handle,
            name: channel.name,
            subscribersText: channel.subscribersText,
            videoCountText: channel.videoCountText,
            sourceUrl: channel.sourceUrl,
            avatar,
            banner,
          });
          next.channelsSaved += 1;
        } catch (error) {
          next.channelsFailed.push({
            handle: channel.handle,
            reason: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    for (let start = 0; start < rows.length; start += IMPORT_BATCH_SIZE) {
      const batch = rows.slice(start, start + IMPORT_BATCH_SIZE);

      try {
        const response = await importBatch.mutateAsync({ rows: batch });

        next.inserted += response.inserted;
        next.skipped += response.skipped;
        response.failed.forEach(({ index, reason }) =>
          next.failed.push({ label: batch[index]?.title ?? "(unknown row)", reason })
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";

        batch.forEach((row) =>
          next.failed.push({ label: row.title, reason: message, retry: row })
        );
      }

      setProgress({ done: Math.min(start + batch.length, rows.length), total: rows.length });
    }

    setProgress(null);
    setResult(next);
    utils.youtubeVideos.getRecent.invalidate();

    if (next.failed.length > 0 || next.channelsFailed.length > 0) {
      toast.error(`Import finished with ${next.failed.length + next.channelsFailed.length} failed`);
    } else {
      toast.success(`Imported ${next.inserted}, skipped ${next.skipped}`);
    }
  };

  return (
    <div className="space-y-5">
      {onBack && (
        <button
          type="button"
          className="text-sm font-semibold text-gray-600 underline underline-offset-2 disabled:opacity-40"
          disabled={isImporting}
          onClick={onBack}
        >
          ← Back to the HTML step
        </button>
      )}

      {/* From step 1 the export is already built — no paste box. */}
      <div className={convertedText ? "hidden" : "space-y-3"}>
        <textarea
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          disabled={isImporting}
          spellCheck={false}
          placeholder="Paste the exported JSON here"
          aria-label="Exported JSON"
          className="h-40 w-full resize-y rounded-xl border border-gray-200 p-3 font-mono text-xs outline-none focus:border-black"
        />

        <div className="flex gap-2">
          <button
            type="button"
            className={BUTTON_PRIMARY}
            disabled={isImporting || !text.trim()}
            onClick={() => preview(text)}
          >
            Preview
          </button>
          <button
            type="button"
            className={BUTTON_BORDERED}
            disabled={isImporting}
            onClick={() => fileInput.current?.click()}
          >
            Choose file
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={onFileChange}
          />
        </div>
      </div>

      {parsed && !parsed.ok && (
        <p role="alert" className="text-sm text-red-600">
          {parsed.error}
        </p>
      )}

      {parsed?.ok && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Rows in file" value={parsed.total} />
            <Stat label="Ready to import" value={rowsToImport.length} />
            <Stat label="Invalid" value={parsed.invalid.length} />
            <Stat label="Duplicates in file" value={parsed.duplicates} />
            <Stat label="Unrelated channel" value={parsed.unrelated} />
            <Stat label="Untitled" value={parsed.placeholderTitles} />
          </div>

          {parsed.channels.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">
                {parsed.channels.length === 1 ? "Channel" : `${parsed.channels.length} channels`}
              </p>
              {parsed.channels.map((channel) => (
                <ChannelPreview key={channel.handle} channel={channel} />
              ))}
            </div>
          )}

          {parsed.unrelated > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeUnrelated}
                disabled={isImporting}
                onChange={(event) => setIncludeUnrelated(event.target.checked)}
              />
              Include {parsed.unrelated.toLocaleString()} from an unrelated channel
            </label>
          )}

          {parsed.invalid.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-semibold">Invalid rows, not imported</p>
              <ul className="space-y-1">
                {parsed.invalid.slice(0, LIST_LIMIT).map((row) => (
                  <li key={row.row} className="text-xs">
                    <span className="font-medium">Row {row.row}:</span>{" "}
                    <span className="text-red-600">{row.reason}</span>{" "}
                    <span className="text-muted-foreground">({row.label})</span>
                  </li>
                ))}
              </ul>
              <More count={parsed.invalid.length} />
            </div>
          )}

          {rowsToImport.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-semibold">About to import</p>
              <ul className="divide-y divide-gray-100">
                {rowsToImport.slice(0, LIST_LIMIT).map((row) => (
                  <li key={row.youtubeId} className="py-2">
                    <p className="line-clamp-1 text-sm">{row.title}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {[
                        row.actualChannelName ?? row.channelName ?? "No channel",
                        row.category ?? "No category",
                        row.youtubeId,
                      ].join(" • ")}
                    </p>
                  </li>
                ))}
              </ul>
              <More count={rowsToImport.length} />
            </div>
          )}

          <button
            type="button"
            className={`${BUTTON_PRIMARY} w-full`}
            disabled={isImporting || rowsToImport.length === 0}
            onClick={() => runImport(rowsToImport, undefined, parsed.channels)}
          >
            {isImporting
              ? `Importing ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()}`
              : `Import ${rowsToImport.length.toLocaleString()} videos`}
          </button>
        </div>
      )}

      {result && (
        <div className="space-y-3 rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold">Import result</p>

          <div className="grid grid-cols-3 gap-2">
            <Stat label="Inserted" value={result.inserted} />
            <Stat label="Already present" value={result.skipped} />
            <Stat label="Failed" value={result.failed.length} />
          </div>

          {(result.channelsSaved > 0 || result.channelsFailed.length > 0) && (
            <p className="text-xs text-muted-foreground">
              {result.channelsSaved} channel{result.channelsSaved === 1 ? "" : "s"} saved
            </p>
          )}
          {result.channelsFailed.map((channel) => (
            <p key={channel.handle} className="text-xs">
              <span className="font-medium">{channel.handle}:</span>{" "}
              <span className="text-red-600">{channel.reason}</span>{" "}
              <span className="text-muted-foreground">— its videos were imported without the channel</span>
            </p>
          ))}

          {result.failed.length > 0 && (
            <div className="space-y-1">
              <ul className="space-y-1">
                {result.failed.slice(0, LIST_LIMIT).map((row, index) => (
                  <li key={index} className="text-xs">
                    <span className="font-medium">{row.label}:</span>{" "}
                    <span className="text-red-600">{row.reason}</span>
                  </li>
                ))}
              </ul>
              <More count={result.failed.length} />
            </div>
          )}

          {result && retryable.length > 0 && (
            <button
              type="button"
              className={BUTTON_BORDERED}
              disabled={isImporting}
              onClick={() => runImport(retryable, result)}
            >
              Retry {retryable.length.toLocaleString()} failed
            </button>
          )}
        </div>
      )}
    </div>
  );
};
