"use client";

import { useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, FileText, Play, Lock, Flame } from "lucide-react";
import { UnlockDialog } from "@/components/content/unlock-dialog";

const MuxPlayer = dynamic(() => import("@mux/mux-player-react"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-video items-center justify-center bg-muted">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

interface MediaRecord {
  id: string;
  type: string;
  status: string;
  variants: Record<string, string> | null;
  muxPlaybackId: string | null;
  width: number | null;
  height: number | null;
  blurUrl?: string | null;
  playbackToken?: string;
  thumbnailToken?: string;
}

interface PostData {
  id: string;
  creatorProfileId: string;
  content: string | null;
  status: string;
  accessLevel?: string;
  isLocked?: boolean;
  publishedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  media?: MediaRecord[];
}

interface PostCardProps {
  post: PostData;
  creatorName?: string;
  creatorAvatar?: string | null;
  isOwner?: boolean;
  tokenTicker?: string;
  requiredBalance?: string;
  viewerBalance?: string;
  creatorTokenId?: string;
  onUnlocked?: () => void;
}

const TRUNCATE_LENGTH = 300;

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function LockedMediaOverlay({
  blurUrl,
  width,
  height,
  tokenTicker,
  requiredBalance,
  accessLevel,
}: {
  blurUrl: string | null;
  width: number | null;
  height: number | null;
  tokenTicker?: string;
  requiredBalance?: string;
  accessLevel?: string;
}) {
  return (
    <div className="relative w-full overflow-hidden">
      {blurUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={blurUrl}
          alt=""
          width={width || 1200}
          height={height || 800}
          className="h-auto w-full object-cover"
        />
      ) : (
        <div
          className="w-full bg-muted"
          style={{ aspectRatio: `${width || 16} / ${height || 9}` }}
        />
      )}
      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
        {accessLevel === "burn_gated" ? (
          <Flame className="mb-2 h-8 w-8 text-orange-400" />
        ) : (
          <Lock className="mb-2 h-8 w-8 text-white" />
        )}
        <p className="text-center text-sm font-medium text-white">
          {accessLevel === "burn_gated"
            ? `Burn ${requiredBalance ?? ""} $${tokenTicker ?? ""} to unlock`
            : `Hold ${requiredBalance ?? ""} $${tokenTicker ?? ""} to unlock`}
        </p>
      </div>
    </div>
  );
}

function PostMediaImage({ media }: { media: MediaRecord }) {
  const variants = media.variants as Record<string, string> | null;
  if (!variants) return null;

  const src = variants.lg || variants.md || variants.sm;
  if (!src) return null;

  return (
    <div className="relative w-full overflow-hidden">
      <Image
        src={src}
        alt=""
        width={media.width || 1200}
        height={media.height || 800}
        className="h-auto w-full object-cover"
        sizes="(max-width: 768px) 100vw, 600px"
      />
    </div>
  );
}

function PostMediaVideo({ media }: { media: MediaRecord }) {
  const [playing, setPlaying] = useState(false);

  if (!media.muxPlaybackId) return null;

  // Determine if we have signed tokens (gated authorized video)
  const hasTokens = media.playbackToken && media.thumbnailToken;

  if (!playing) {
    const thumbnailSrc = hasTokens
      ? `https://image.mux.com/${media.muxPlaybackId}/thumbnail.jpg?token=${media.thumbnailToken}`
      : `https://image.mux.com/${media.muxPlaybackId}/thumbnail.jpg`;

    return (
      <button
        type="button"
        className="relative aspect-video w-full overflow-hidden bg-black"
        onClick={() => setPlaying(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailSrc}
          alt="Video thumbnail"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white transition-transform hover:scale-110">
            <Play className="h-6 w-6 fill-current" />
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="aspect-video w-full">
      <MuxPlayer
        playbackId={media.muxPlaybackId}
        autoPlay
        className="h-full w-full"
        {...(hasTokens
          ? {
              tokens: {
                playback: media.playbackToken,
                thumbnail: media.thumbnailToken,
              },
            }
          : {})}
      />
    </div>
  );
}

export function PostCard({
  post,
  creatorName,
  creatorAvatar,
  isOwner,
  tokenTicker,
  requiredBalance,
  viewerBalance,
  creatorTokenId,
  onUnlocked,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);

  const content = post.content || "";
  const shouldTruncate = content.length > TRUNCATE_LENGTH;
  const displayContent = shouldTruncate && !expanded
    ? content.slice(0, TRUNCATE_LENGTH) + "..."
    : content;

  const isLocked = post.isLocked === true;
  const isGated = post.accessLevel === "hold_gated" || post.accessLevel === "burn_gated";

  const images = (post.media || []).filter((m) => m.type === "image" && (isLocked || m.status === "ready"));
  const videos = (post.media || []).filter((m) => m.type === "video" && (isLocked || m.status === "ready"));

  const displayDate = post.publishedAt || post.createdAt;

  return (
    <Card className="overflow-hidden">
      {/* Header: creator info + metadata */}
      <div className="flex items-center gap-3 px-6 pt-5">
        {/* Avatar */}
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
          {creatorAvatar ? (
            <Image
              src={creatorAvatar}
              alt={creatorName || "Creator"}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10 text-sm font-bold text-primary">
              {(creatorName || "?").charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">
              {creatorName || "Creator"}
            </span>
            {/* Status badges for owner */}
            {isOwner && post.status === "draft" && (
              <Badge variant="secondary">
                <FileText className="h-3 w-3" />
                Draft
              </Badge>
            )}
            {isOwner && post.status === "processing" && (
              <Badge variant="secondary">
                <Loader2 className="h-3 w-3 animate-spin" />
                Processing
              </Badge>
            )}
            {isOwner && post.status === "under_review" && (
              <Badge variant="outline">
                <AlertTriangle className="h-3 w-3" />
                Under Review
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(displayDate)}
            </span>
            {/* Gating badge */}
            {isGated && (
              <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                {post.accessLevel === "burn_gated" ? (
                  <Flame className="h-3 w-3 text-orange-500" />
                ) : (
                  <Lock className="h-3 w-3" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Text content -- always visible regardless of lock status */}
      {content && (
        <CardContent className="pb-0">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {displayContent}
          </p>
          {shouldTruncate && !expanded && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => setExpanded(true)}
            >
              Read more
            </Button>
          )}
        </CardContent>
      )}

      {/* Media: locked state */}
      {isLocked && (images.length > 0 || videos.length > 0) && (
        <div className="mt-3 space-y-1">
          {[...images, ...videos].map((m) => (
            <LockedMediaOverlay
              key={m.id}
              blurUrl={m.blurUrl ?? null}
              width={m.width}
              height={m.height}
              tokenTicker={tokenTicker}
              requiredBalance={requiredBalance}
              accessLevel={post.accessLevel}
            />
          ))}
        </div>
      )}

      {/* Media: unlocked state */}
      {!isLocked && images.length > 0 && (
        <div className="mt-3 space-y-1">
          {images.map((img) => (
            <PostMediaImage key={img.id} media={img} />
          ))}
        </div>
      )}

      {!isLocked && videos.length > 0 && (
        <div className="mt-3 space-y-1">
          {videos.map((vid) => (
            <PostMediaVideo key={vid.id} media={vid} />
          ))}
        </div>
      )}

      {/* Unlock button for locked posts */}
      {isLocked && (
        <div className="px-6 py-3">
          <Button
            onClick={() => setUnlockOpen(true)}
            className="w-full"
            variant="outline"
          >
            <Lock className="h-4 w-4" />
            Unlock
          </Button>
        </div>
      )}

      {/* Bottom padding (only for non-locked posts since locked have the button) */}
      {!isLocked && <div className="h-4" />}

      {/* Unlock dialog */}
      {isLocked && creatorTokenId && tokenTicker && requiredBalance && (
        <UnlockDialog
          isOpen={unlockOpen}
          onClose={() => setUnlockOpen(false)}
          accessLevel={post.accessLevel as "hold_gated" | "burn_gated"}
          requiredBalance={requiredBalance}
          viewerBalance={viewerBalance ?? "0"}
          tokenTicker={tokenTicker}
          creatorTokenId={creatorTokenId}
          postId={post.id}
          onUnlocked={onUnlocked}
        />
      )}
    </Card>
  );
}
