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
import { Input } from "@/components/ui/input";
import { MediaUpload } from "@/components/content/media-upload";
import { VideoUpload } from "@/components/content/video-upload";
import {
  ImageIcon,
  Video,
  Loader2,
  Globe,
  Lock,
  Flame,
  ArrowLeft,
} from "lucide-react";

type MediaType = "image" | "video";
type AccessLevel = "public" | "hold_gated" | "burn_gated";
type PublishStep = "compose" | "access";

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

const ACCESS_LEVEL_OPTIONS: {
  value: AccessLevel;
  label: string;
  description: string;
  icon: typeof Globe;
}[] = [
  {
    value: "public",
    label: "Public",
    description: "Anyone can view this post",
    icon: Globe,
  },
  {
    value: "hold_gated",
    label: "Hold-Gated",
    description: "Viewers must hold tokens to unlock",
    icon: Lock,
  },
  {
    value: "burn_gated",
    label: "Burn-Gated",
    description: "Viewers burn tokens for permanent access (cost set by token burn price)",
    icon: Flame,
  },
];

export function PostComposer({ isOpen, onClose, onPublished }: PostComposerProps) {
  const [content, setContent] = useState("");
  const [attachedMedia, setAttachedMedia] = useState<AttachedMedia[]>([]);
  const [postId, setPostId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Access level state
  const [publishStep, setPublishStep] = useState<PublishStep>("compose");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("public");
  const [tokenThreshold, setTokenThreshold] = useState("");

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
      setPublishStep("compose");
      setAccessLevel("public");
      setTokenThreshold("");
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

  // Validate token threshold for gated posts
  const isThresholdValid = useCallback((value: string): boolean => {
    if (!value.trim()) return false;
    try {
      const n = BigInt(value.trim());
      return n > BigInt(0);
    } catch {
      return false;
    }
  }, []);

  // Move to access level step (save draft first if needed)
  const handleGoToAccessStep = useCallback(async () => {
    if (!allMediaReady) return;

    // Ensure draft is saved first
    let currentPostId = postId;
    if (!currentPostId) {
      try {
        const res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });

        if (!res.ok) throw new Error("Failed to create post");
        const data = await res.json();
        currentPostId = data.post.id;
        setPostId(currentPostId);
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("Draft save failed:", err);
        alert("Failed to save draft before publishing");
        return;
      }
    } else if (hasUnsavedChanges) {
      try {
        await fetch(`/api/posts/${currentPostId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("Draft save failed:", err);
        alert("Failed to save draft before publishing");
        return;
      }
    }

    setPublishStep("access");
  }, [allMediaReady, postId, content, hasUnsavedChanges]);

  // Publish post with access level
  const handlePublish = useCallback(async () => {
    if (isPublishing) return;

    // Validate threshold for hold_gated posts (burn_gated uses on-chain burn price)
    if (accessLevel === "hold_gated" && !isThresholdValid(tokenThreshold)) {
      alert("Please enter a valid positive integer for the token threshold");
      return;
    }

    setIsPublishing(true);

    try {
      const publishRes = await fetch(
        `/api/posts/${postId}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessLevel,
            ...(accessLevel === "hold_gated" ? { tokenThreshold: tokenThreshold.trim() } : {}),
          }),
        },
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
    postId,
    accessLevel,
    tokenThreshold,
    isThresholdValid,
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

  const canGoToAccess =
    (content.trim().length > 0 || attachedMedia.length > 0) &&
    allMediaReady &&
    !isPublishing;

  const canPublish =
    accessLevel === "public" || accessLevel === "burn_gated" || isThresholdValid(tokenThreshold);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {publishStep === "compose" ? (
          <>
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

                {/* Publish button (goes to access step) */}
                <Button
                  onClick={handleGoToAccessStep}
                  disabled={!canGoToAccess}
                  type="button"
                >
                  Publish
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
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Set Access Level</DialogTitle>
              <DialogDescription>
                Choose who can view this post.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Access level options */}
              <div className="space-y-2">
                {ACCESS_LEVEL_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = accessLevel === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setAccessLevel(option.value);
                        if (option.value === "public") {
                          setTokenThreshold("");
                        }
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Token threshold input (for hold_gated posts) */}
              {accessLevel === "hold_gated" && (
                <div className="space-y-2">
                  <label
                    htmlFor="token-threshold"
                    className="text-sm font-medium"
                  >
                    Minimum tokens required
                  </label>
                  <Input
                    id="token-threshold"
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 1000"
                    value={tokenThreshold}
                    onChange={(e) => setTokenThreshold(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    How many tokens must viewers hold to access this post?
                  </p>
                </div>
              )}

              {/* Burn cost info (for burn_gated posts) */}
              {accessLevel === "burn_gated" && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-950">
                  <p className="text-xs text-orange-700 dark:text-orange-300">
                    Burn cost is determined by your token&apos;s burn price setting (set at token creation). All burn-gated posts share the same burn cost.
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-between border-t pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setPublishStep("compose")}
                  type="button"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>

                <Button
                  onClick={handlePublish}
                  disabled={!canPublish || isPublishing}
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
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
