"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, ImageIcon, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type MediaUploadStatus =
  | "idle"
  | "uploading"
  | "scanning"
  | "processing"
  | "ready"
  | "flagged"
  | "failed";

interface UploadedMedia {
  mediaId: string;
  variants: Record<string, string>;
  previewUrl: string;
}

interface MediaUploadProps {
  file: File;
  postId?: string;
  onUploaded: (media: UploadedMedia) => void;
  onRemove: () => void;
}

export function MediaUpload({
  file,
  postId,
  onUploaded,
  onRemove,
}: MediaUploadProps) {
  const [status, setStatus] = useState<MediaUploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [previewUrl] = useState(() => URL.createObjectURL(file));
  const [error, setError] = useState<string | null>(null);

  const startUpload = useCallback(async () => {
    if (status !== "idle") return;

    try {
      setStatus("uploading");
      setProgress(0);

      // Step 1: Get presigned URL
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: file.type,
          purpose: "post-media",
          postId,
        }),
      });

      if (!presignRes.ok) {
        const err = await presignRes.json();
        throw new Error(err.error || "Failed to get upload URL");
      }

      const { uploadUrl, mediaId } = await presignRes.json();

      // Step 2: Upload to R2 via XHR for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.send(file);
      });

      // Step 3: Confirm upload (triggers CSAM scan + image processing)
      setStatus("scanning");
      const confirmRes = await fetch(`/api/media/${mediaId}/confirm`, {
        method: "POST",
      });

      if (!confirmRes.ok) {
        const err = await confirmRes.json();
        throw new Error(err.error || "Processing failed");
      }

      const confirmData = await confirmRes.json();

      if (confirmData.status === "flagged") {
        setStatus("flagged");
        setError("This image could not be processed");
        return;
      }

      if (confirmData.status === "ready" && confirmData.variants) {
        setStatus("ready");
        onUploaded({
          mediaId,
          variants: confirmData.variants,
          previewUrl: confirmData.variants.md || previewUrl,
        });
        return;
      }

      // Shouldn't reach here for images, but handle gracefully
      setStatus("processing");
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }, [file, postId, status, previewUrl, onUploaded]);

  // Auto-start upload on mount
  useState(() => {
    startUpload();
  });

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-muted/50">
      {/* Preview image */}
      <div className="relative aspect-video w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Upload preview"
          className={cn(
            "h-full w-full object-cover",
            status !== "ready" && "opacity-60",
          )}
        />

        {/* Overlay for non-ready states */}
        {status !== "ready" && status !== "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
            {status === "uploading" && (
              <>
                <div className="mb-2 text-sm font-medium text-white">
                  Uploading... {progress}%
                </div>
                <div className="h-1.5 w-3/4 overflow-hidden rounded-full bg-white/30">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </>
            )}
            {status === "scanning" && (
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning...
              </div>
            )}
            {status === "processing" && (
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </div>
            )}
            {status === "flagged" && (
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            {status === "failed" && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error || "Upload failed"}
                </div>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => {
                    setStatus("idle");
                    setError(null);
                    startUpload();
                  }}
                >
                  Retry
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Ready indicator */}
        {status === "ready" && (
          <div className="absolute bottom-2 left-2">
            <CheckCircle2 className="h-5 w-5 text-green-500 drop-shadow" />
          </div>
        )}
      </div>

      {/* Remove button */}
      <Button
        variant="destructive"
        size="icon-xs"
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={onRemove}
        type="button"
      >
        <X className="h-3 w-3" />
      </Button>

      {/* Image icon for empty-ish state */}
      {!previewUrl && (
        <div className="flex h-32 items-center justify-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
