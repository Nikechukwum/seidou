"use client";

import { UploadIcon } from "lucide-react";
import MuxUploader, {
  MuxUploaderDrop,
  MuxUploaderFileSelect,
  MuxUploaderProgress,
  MuxUploaderStatus,
} from "@mux/mux-uploader-react";

import { Button } from "@/components/Button";

interface StudioUploaderProps {
  /**
   * Either a ready-made upload URL, or a function the uploader calls once the
   * user has actually chosen a file. The function form is what lets us avoid
   * reserving a Mux upload (and inserting a database row) for people who open
   * the dialog and change their mind.
   */
  endpoint?: string | ((file?: File) => Promise<string>) | null;
  onSuccess: () => void;
}

const UPLOADER_ID = "video-uploader";

/**
 * Uploads straight from the browser to Mux using a one-time URL. The file
 * never touches this server, so there is no body-size limit and no proxy cost.
 */
export const StudioUploader = ({ endpoint, onSuccess }: StudioUploaderProps) => {
  return (
    <div>
      <MuxUploader
        onSuccess={onSuccess}
        endpoint={endpoint}
        id={UPLOADER_ID}
        className="hidden group/uploader"
      />
      <MuxUploaderDrop muxUploader={UPLOADER_ID} className="group/drop">
        <div slot="heading" className="flex flex-col items-center gap-6">
          <div className="flex items-center justify-center gap-2 rounded-full bg-muted h-28 w-28">
            <UploadIcon className="size-10 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-2 text-center">
            <p className="text-sm">Choose a video to upload</p>
            <p className="text-xs text-muted-foreground">
              Your video stays private until you publish it
            </p>
          </div>
          <MuxUploaderFileSelect muxUploader={UPLOADER_ID}>
            <Button text="Select file" size="sm" />
          </MuxUploaderFileSelect>
        </div>
        <span slot="separator" className="hidden" />
        <MuxUploaderStatus muxUploader={UPLOADER_ID} className="text-sm" />
        <MuxUploaderProgress
          muxUploader={UPLOADER_ID}
          className="text-sm"
          type="percentage"
        />
        <MuxUploaderProgress muxUploader={UPLOADER_ID} type="bar" />
      </MuxUploaderDrop>
    </div>
  );
};
