"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

interface ModerationItem {
  id: string;
  mediaId: string | null;
  postId: string | null;
  action: string;
  reason: string | null;
  confidence: string | null;
  createdAt: string;
  mediaType: string | null;
  mediaStatus: string | null;
  mediaOriginalKey: string | null;
  mediaVariants: Record<string, string> | null;
  mediaMimeType: string | null;
  postContent: string | null;
  postStatus: string | null;
  creatorProfileId: string | null;
  creatorDisplayName: string | null;
  creatorAvatarUrl: string | null;
  creatorStrikeCount: number;
}

const REJECT_REASONS = [
  "CSAM confirmed",
  "Policy violation",
  "Other",
] as const;

export function ModerationQueue() {
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [revealedMedia, setRevealedMedia] = useState<Set<string>>(new Set());
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const limit = 20;

  const fetchQueue = useCallback(
    async (currentOffset: number) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/moderation?limit=${limit}&offset=${currentOffset}`,
        );
        if (!res.ok) {
          if (res.status === 403) {
            toast.error("Access denied: admin privileges required");
            return;
          }
          throw new Error("Failed to fetch moderation queue");
        }
        const data = await res.json();
        if (currentOffset === 0) {
          setItems(data.items);
        } else {
          setItems((prev) => [...prev, ...data.items]);
        }
        setTotal(data.total);
      } catch {
        toast.error("Failed to load moderation queue");
      } finally {
        setLoading(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    fetchQueue(0);
  }, [fetchQueue]);

  async function handleApprove(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/moderation/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotal((prev) => prev - 1);
      toast.success("Content approved");
    } catch {
      toast.error("Failed to approve content");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/moderation/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectReason }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      const data = await res.json();
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotal((prev) => prev - 1);
      setRejectingId(null);
      setRejectReason("");

      const strike = data.strike;
      if (strike) {
        toast.success(
          `Content rejected. Strike ${strike.strikeNumber} issued (${strike.consequence})`,
        );
      } else {
        toast.success("Content rejected");
      }
    } catch {
      toast.error("Failed to reject content");
    } finally {
      setActionLoading(null);
    }
  }

  function toggleMediaReveal(id: string) {
    setRevealedMedia((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function formatFlagReason(reason: string | null, confidence: string | null) {
    if (reason === "hash_match") return "Hash match (known CSAM)";
    if (reason === "classifier")
      return `AI classifier (confidence: ${confidence ?? "N/A"})`;
    return reason ?? "Unknown";
  }

  function loadMore() {
    const newOffset = offset + limit;
    setOffset(newOffset);
    fetchQueue(newOffset);
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">
          Loading moderation queue...
        </span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
        <h3 className="text-lg font-semibold">No items pending review</h3>
        <p className="text-muted-foreground mt-1">
          The moderation queue is clear.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {total} item{total !== 1 ? "s" : ""} pending review
      </p>

      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {item.creatorAvatarUrl ? (
                  <img
                    src={item.creatorAvatarUrl}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                    {item.creatorDisplayName?.charAt(0) ?? "?"}
                  </div>
                )}
                <div>
                  <CardTitle className="text-base">
                    {item.creatorDisplayName ?? "Unknown Creator"}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {formatFlagReason(item.reason, item.confidence)}
                    </Badge>
                    {item.creatorStrikeCount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {item.creatorStrikeCount} strike
                        {item.creatorStrikeCount !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleDateString()}
              </span>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Media preview with blur overlay */}
            {item.mediaOriginalKey && (
              <div className="relative">
                {revealedMedia.has(item.id) ? (
                  <div className="relative">
                    {item.mediaType === "image" && item.mediaVariants ? (
                      <img
                        src={
                          (item.mediaVariants as Record<string, string>).sm ??
                          ""
                        }
                        alt="Flagged content"
                        className="max-h-64 rounded-md object-contain"
                      />
                    ) : (
                      <div className="bg-muted rounded-md p-4 text-sm text-muted-foreground">
                        Video content (ID: {item.mediaId})
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => toggleMediaReveal(item.id)}
                    >
                      <EyeOff className="h-4 w-4 mr-1" />
                      Hide
                    </Button>
                  </div>
                ) : (
                  <div className="relative bg-muted rounded-md p-8 flex flex-col items-center justify-center">
                    <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">
                      Flagged {item.mediaType ?? "media"} content (hidden by
                      default)
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleMediaReveal(item.id)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Reveal
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Post content */}
            {item.postContent && (
              <div className="bg-muted/50 rounded-md p-3">
                <p className="text-xs text-muted-foreground mb-1">
                  Post content
                </p>
                <p className="text-sm">{item.postContent}</p>
              </div>
            )}

            {/* Reject reason input */}
            {rejectingId === item.id && (
              <div className="space-y-2 border rounded-md p-3">
                <p className="text-sm font-medium">Rejection reason</p>
                <div className="flex flex-wrap gap-2">
                  {REJECT_REASONS.map((reason) => (
                    <Button
                      key={reason}
                      variant={
                        rejectReason === reason ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setRejectReason(reason)}
                    >
                      {reason}
                    </Button>
                  ))}
                </div>
                <Input
                  placeholder="Or type a custom reason..."
                  value={
                    REJECT_REASONS.includes(
                      rejectReason as (typeof REJECT_REASONS)[number],
                    )
                      ? ""
                      : rejectReason
                  }
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={
                      !rejectReason.trim() || actionLoading === item.id
                    }
                    onClick={() => handleReject(item.id)}
                  >
                    {actionLoading === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-1" />
                    )}
                    Confirm Reject
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRejectingId(null);
                      setRejectReason("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>

          {rejectingId !== item.id && (
            <CardFooter className="gap-2">
              <Button
                variant="outline"
                className="text-green-600 border-green-600 hover:bg-green-50"
                disabled={actionLoading === item.id}
                onClick={() => handleApprove(item.id)}
              >
                {actionLoading === item.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                Approve
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-600 hover:bg-red-50"
                disabled={actionLoading === item.id}
                onClick={() => setRejectingId(item.id)}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </CardFooter>
          )}
        </Card>
      ))}

      {items.length < total && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : null}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
