"use client";

import { ReactNode, useRef, useState } from "react";
import { Loader2Icon } from "lucide-react";

import { toast } from "@/social/lib/toast";
import { uploadSocialImage, type UploadResult } from "@/social/lib/storage";

interface ImageUploadButtonProps {
  /** Deterministic storage path — see social/lib/storage.ts. */
  path: string;
  label: string;
  onUploaded: (result: UploadResult) => void | Promise<void>;
  className?: string;
  /**
   * Replaces the default pill. Used by the avatar's corner badge and the
   * empty banner strip, which need to look nothing like a button.
   */
  children?: ReactNode;
}

/**
 * Seidou has no file-input pattern of its own, so this is written from
 * scratch rather than ported. The native input is hidden and driven by a
 * button, because an unstyled file input looks broken next to Seidou's forms.
 */
export const ImageUploadButton = ({
  path,
  label,
  onUploaded,
  className = "",
  children,
}: ImageUploadButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await uploadSocialImage(file, path);
      await onUploaded(result);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not upload image"
      );
    } finally {
      setIsUploading(false);
      // Reset so choosing the same file twice still fires a change event.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        aria-label={label}
        className={
          children
            ? `disabled:opacity-50 ${className}`
            : `flex items-center justify-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold disabled:opacity-50 ${className}`
        }
      >
        {children ?? (
          <>
            {isUploading && <Loader2Icon className="size-4 animate-spin" />}
            {isUploading ? "Uploading…" : label}
          </>
        )}
      </button>
    </>
  );
};
