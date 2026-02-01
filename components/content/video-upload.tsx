"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { X, Video, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const MuxUploader = dynamic(() => import("@mux/mux-uploader-react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-20 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ),
});

type VideoUploadStatus =
  | "idle"
  | "uploading-r2"
  | "scanning"
  | "uploading-mux"
  | "processing"
  | "ready"
  | "flagged"
  | "failed";

interface UploadedVideo {
  mediaId: string;
  muxPlaybackId: string;
}

interface VideoUploadProps {
  file: File;
  postId?: string;
  onUploaded: (media: UploadedVideo) => void;
  onRemove: () => void;
}

const STATUS_LABELS: Record<VideoUploadStatus, string> = {
  idle: "Preparing...",
  "uploading-r2": "Uploading to storage...",
  scanning: "Scanning...",
  "uploading-mux": "Uploading for processing...",
  processing: "Processing...",
  ready: "Ready",
  flagged: "Content flagged",
  failed: "Failed",
};

export function VideoUpload({
  file,
  postId,
  onUploaded,
  onRemove,
}: VideoUploadProps) {
  const [status, setStatus] = useState<VideoUploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [muxUploadUrl, setMuxUploadUrl] = useState<string | null>(null);
  const [muxPlaybackId, setMuxPlaybackId] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const startUpload = useCallback(async () => {
    if (status !== "idle") return;

    try {
      setStatus("uploading-r2");
      setProgress(0);

      // Step 1: Get R2 presigned URL
      const videoRes = await fetch("/api/upload/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });

      if (!videoRes.ok) {
        const err = await videoRes.json();
        throw new Error(err.error || "Failed to create video upload");
      }

      const { mediaId: newMediaId, r2UploadUrl } = await videoRes.json();
      setMediaId(newMediaId);

      // Step 2: Upload original to R2 via XHR with progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", r2UploadUrl);
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
            reject(new Error(`R2 upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () =>
          reject(new Error("R2 upload failed")),
        );
        xhr.send(file);
      });

      // Step 3: Confirm upload (triggers CSAM scan)
      setStatus("scanning");
      const confirmRes = await fetch(`/api/media/${newMediaId}/confirm`, {
        method: "POST",
      });

      if (!confirmRes.ok) {
        const err = await confirmRes.json();
        throw new Error(err.error || "Processing failed");
      }

      const confirmData = await confirmRes.json();

      if (confirmData.status === "flagged") {
        setStatus("flagged");
        setError("This video could not be processed");
        return;
      }

      // Step 4: Scan passed - Mux upload URL returned
      if (confirmData.muxUploadUrl) {
        setStatus("uploading-mux");
        setMuxUploadUrl(confirmData.muxUploadUrl);
        // MuxUploader component will handle the upload from here
        // After Mux upload completes, we poll for processing status
      }
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }, [file, postId, status]);

  // Poll for media status after Mux upload completes
  const startPolling = useCallback(() => {
    if (!mediaId || pollIntervalRef.current) return;

    setStatus("processing");

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/media/${mediaId}`);
        if (!res.ok) return;

        const data = await res.json();

        if (data.status === "ready" && data.muxPlaybackId) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setStatus("ready");
          setMuxPlaybackId(data.muxPlaybackId);
          onUploaded({
            mediaId,
            muxPlaybackId: data.muxPlaybackId,
          });
        } else if (data.status === "failed") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setStatus("failed");
          setError("Video processing failed");
        }
      } catch {
        // Ignore polling errors, will retry
      }
    }, 5000);
  }, [mediaId, onUploaded]);

  // Auto-start upload on mount
  useState(() => {
    startUpload();
  });

  const showProgressBar =
    status === "uploading-r2" || status === "uploading-mux";
  const showSpinner =
    status === "scanning" || status === "processing";

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-muted/50">
      <div className="relative flex min-h-[120px] flex-col items-center justify-center p-4">
        {/* Video icon */}
        <Video
          className={cn(
            "mb-2 h-8 w-8",
            status === "ready"
              ? "text-green-500"
              : "text-muted-foreground",
          )}
        />

        {/* Status label */}
        <div className="mb-2 text-sm font-medium">
          {STATUS_LABELS[status]}
        </div>

        {/* Progress bar */}
        {showProgressBar && (
          <div className="h-1.5 w-3/4 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Spinner */}
        {showSpinner && (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        )}

        {/* Ready indicator */}
        {status === "ready" && (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        )}

        {/* Error state */}
        {(status === "flagged" || status === "failed") && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
            {status === "failed" && (
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
            )}
          </div>
        )}

        {/* Mux Uploader (hidden, used for Mux direct upload) */}
        {muxUploadUrl && status === "uploading-mux" && (
          <div className="mt-2 w-full">
            <MuxUploader
              endpoint={muxUploadUrl}
              onSuccess={() => {
                startPolling();
              }}
              onError={() => {
                setStatus("failed");
                setError("Mux upload failed");
              }}
              /* @ts-expect-error MuxUploader event type mismatch between GenericEventListener and ReactEventHandler */
              onProgress={(e: CustomEvent<number>) => {
                setProgress(Math.round(e.detail));
              }}
              className="hidden"
            />
          </div>
        )}

        {/* Mux thumbnail for ready state */}
        {status === "ready" && muxPlaybackId && (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://image.mux.com/${muxPlaybackId}/thumbnail.jpg`}
              alt="Video thumbnail"
              className="h-16 w-auto rounded"
            />
          </div>
        )}
      </div>

      {/* Remove button */}
      <Button
        variant="destructive"
        size="icon-xs"
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          onRemove();
        }}
        type="button"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
