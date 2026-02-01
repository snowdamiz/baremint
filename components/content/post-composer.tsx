"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MediaUpload } from "@/components/content/media-upload";
import { VideoUpload } from "@/components/content/video-upload";
import { ImageIcon, Video, Loader2 } from "lucide-react";

type MediaType = "image" | "video";

interface AttachedMedia {
  localId: string;
  file: File;
  type: MediaType;
  status: "uploading" | "scanning" | "processing" | "ready" | "flagged" | "failed";
  mediaId?: string;
  previewUrl?: string;
  variants?: Record<string, string>;
  muxPlaybackId?: string;
}

interface PostComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onPublished: (post: { id: string; content: string | null; status: string }) => void;
}

export function PostComposer({ isOpen, onClose, onPublished }: PostComposerProps) {
  const [content, setContent] = useState("");
  const [attachedMedia, setAttachedMedia] = useState<AttachedMedia[]>([]);
  const [postId, setPostId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setContent(value);
      setHasUnsavedChanges(true);
      setSaveStatus("idle");

      // Auto-resize
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }

      // Debounced auto-save (10 seconds)
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        saveDraft(value);
      }, 10000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [postId],
  );

  // Save draft
  const saveDraft = useCallback(
    async (text: string) => {
      if (isSaving) return;
      setIsSaving(true);
      setSaveStatus("saving");

      try {
        if (!postId) {
          // Create new draft
          const res = await fetch("/api/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: text }),
          });

          if (!res.ok) {
            throw new Error("Failed to save draft");
          }

          const data = await res.json();
          setPostId(data.post.id);
        } else {
          // Update existing draft
          const res = await fetch(`/api/posts/${postId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: text }),
          });

          if (!res.ok) {
            throw new Error("Failed to update draft");
          }
        }

        setSaveStatus("saved");
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("Draft save failed:", err);
        setSaveStatus("idle");
      } finally {
        setIsSaving(false);
      }
    },
    [postId, isSaving],
  );

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setContent("");
      setAttachedMedia([]);
      setPostId(null);
      setIsSaving(false);
      setIsPublishing(false);
      setSaveStatus("idle");
      setHasUnsavedChanges(false);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    }
  }, [isOpen]);

  // Handle image file selection
  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      for (const file of Array.from(files)) {
        if (file.size > 25 * 1024 * 1024) {
          alert("Image must be under 25MB");
          continue;
        }

        const localId = crypto.randomUUID();
        setAttachedMedia((prev) => [
          ...prev,
          {
            localId,
            file,
            type: "image",
            status: "uploading",
          },
        ]);
      }

      // Reset input
      e.target.value = "";
    },
    [],
  );

  // Handle video file selection
  const handleVideoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const localId = crypto.randomUUID();
      setAttachedMedia((prev) => [
        ...prev,
        {
          localId,
          file,
          type: "video",
          status: "uploading",
        },
      ]);

      // Reset input
      e.target.value = "";
    },
    [],
  );

  // Remove attached media
  const removeMedia = useCallback((localId: string) => {
    setAttachedMedia((prev) => prev.filter((m) => m.localId !== localId));
  }, []);

  // Update media status when upload completes
  const handleImageUploaded = useCallback(
    (localId: string, data: { mediaId: string; variants: Record<string, string>; previewUrl: string }) => {
      setAttachedMedia((prev) =>
        prev.map((m) =>
          m.localId === localId
            ? {
                ...m,
                status: "ready" as const,
                mediaId: data.mediaId,
                variants: data.variants,
                previewUrl: data.previewUrl,
              }
            : m,
        ),
      );
    },
    [],
  );

  const handleVideoUploaded = useCallback(
    (localId: string, data: { mediaId: string; muxPlaybackId: string }) => {
      setAttachedMedia((prev) =>
        prev.map((m) =>
          m.localId === localId
            ? {
                ...m,
                status: "ready" as const,
                mediaId: data.mediaId,
                muxPlaybackId: data.muxPlaybackId,
              }
            : m,
        ),
      );
    },
    [],
  );

  // Check if all media is ready
  const allMediaReady =
    attachedMedia.length === 0 ||
    attachedMedia.every((m) => m.status === "ready");

  const anyMediaProcessing = attachedMedia.some(
    (m) =>
      m.status === "uploading" ||
      m.status === "scanning" ||
      m.status === "processing",
  );

  // Publish post
  const handlePublish = useCallback(async () => {
    if (isPublishing || !allMediaReady) return;

    setIsPublishing(true);

    try {
      // Ensure draft is saved first
      let currentPostId = postId;
      if (!currentPostId) {
        const res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });

        if (!res.ok) throw new Error("Failed to create post");
        const data = await res.json();
        currentPostId = data.post.id;
        setPostId(currentPostId);
      } else if (hasUnsavedChanges) {
        await fetch(`/api/posts/${currentPostId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
      }

      // Publish
      const publishRes = await fetch(
        `/api/posts/${currentPostId}/publish`,
        { method: "POST" },
      );

      if (!publishRes.ok) {
        const err = await publishRes.json();
        throw new Error(err.error || "Failed to publish");
      }

      const publishData = await publishRes.json();
      onPublished(publishData.post);
      onClose();
    } catch (err) {
      console.error("Publish failed:", err);
      alert(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setIsPublishing(false);
    }
  }, [
    isPublishing,
    allMediaReady,
    postId,
    content,
    hasUnsavedChanges,
    onPublished,
    onClose,
  ]);

  // Close with confirmation
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges && (content.trim() || attachedMedia.length > 0)) {
      const confirmed = window.confirm(
        "You have unsaved changes. Discard this draft?",
      );
      if (!confirmed) return;
    }
    onClose();
  }, [hasUnsavedChanges, content, attachedMedia, onClose]);

  const canPublish =
    (content.trim().length > 0 || attachedMedia.length > 0) &&
    allMediaReady &&
    !isPublishing;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
          <DialogDescription>
            Share an update with your supporters.
          </DialogDescription>
        </DialogHeader>

        {/* Text input */}
        <div className="space-y-4">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={handleTextChange}
              placeholder="What's on your mind?"
              className="min-h-[120px] resize-none border-0 p-0 text-base shadow-none focus-visible:ring-0"
              rows={4}
            />

            {/* Save status indicator */}
            {saveStatus !== "idle" && (
              <div className="absolute right-0 bottom-0 text-xs text-muted-foreground">
                {saveStatus === "saving" && (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving...
                  </span>
                )}
                {saveStatus === "saved" && <span>Saved</span>}
              </div>
            )}
          </div>

          {/* Attached media previews */}
          {attachedMedia.length > 0 && (
            <div className="space-y-3">
              {attachedMedia.map((m) =>
                m.type === "image" ? (
                  <MediaUpload
                    key={m.localId}
                    file={m.file}
                    postId={postId ?? undefined}
                    onUploaded={(data) => handleImageUploaded(m.localId, data)}
                    onRemove={() => removeMedia(m.localId)}
                  />
                ) : (
                  <VideoUpload
                    key={m.localId}
                    file={m.file}
                    postId={postId ?? undefined}
                    onUploaded={(data) => handleVideoUploaded(m.localId, data)}
                    onRemove={() => removeMedia(m.localId)}
                  />
                ),
              )}
            </div>
          )}

          {/* Media processing warning */}
          {anyMediaProcessing && (
            <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Media processing... Publishing will be available when complete.
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center justify-between border-t pt-4">
            {/* Media buttons */}
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => imageInputRef.current?.click()}
                type="button"
              >
                <ImageIcon className="h-4 w-4" />
                Add Image
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => videoInputRef.current?.click()}
                type="button"
              >
                <Video className="h-4 w-4" />
                Add Video
              </Button>
            </div>

            {/* Publish button */}
            <Button
              onClick={handlePublish}
              disabled={!canPublish}
              type="button"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                "Publish"
              )}
            </Button>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleImageSelect}
            multiple
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/quicktime"
            className="hidden"
            onChange={handleVideoSelect}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
