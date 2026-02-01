"use client";

import { useState, useCallback, useEffect } from "react";
import { PostCard } from "@/components/content/post-card";
import { PostComposer } from "@/components/content/post-composer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Loader2, FileText } from "lucide-react";

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
  tokenThreshold?: string | null;
  creatorTokenId?: string | null;
  isLocked?: boolean;
  publishedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  media?: MediaRecord[];
  mediaCount?: number;
}

interface GatedMediaResponse {
  media: MediaRecord[];
  isLocked: boolean;
  accessLevel?: string;
  requiredBalance?: string;
  viewerBalance?: string;
  tokenTicker?: string | null;
}

interface PostFeedProps {
  creatorProfileId: string;
  creatorName: string;
  creatorAvatar: string | null;
  isOwner: boolean;
}

const PAGE_SIZE = 20;

/** Fetch gated media data for a single post */
async function fetchGatedMedia(postId: string): Promise<GatedMediaResponse | null> {
  try {
    const res = await fetch(`/api/content/${postId}/media`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function PostFeed({
  creatorProfileId,
  creatorName,
  creatorAvatar,
  isOwner,
}: PostFeedProps) {
  const [publishedPosts, setPublishedPosts] = useState<PostData[]>([]);
  const [gatedData, setGatedData] = useState<Record<string, GatedMediaResponse>>({});
  const [drafts, setDrafts] = useState<PostData[]>([]);
  const [totalPublished, setTotalPublished] = useState(0);
  const [isLoadingPublished, setIsLoadingPublished] = useState(true);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  // Fetch gated media for posts that need it
  const fetchGatedMediaForPosts = useCallback(async (posts: PostData[]) => {
    const gatedPosts = posts.filter(
      (p) => p.accessLevel && p.accessLevel !== "public",
    );

    if (gatedPosts.length === 0) return;

    const results = await Promise.all(
      gatedPosts.map(async (p) => {
        const data = await fetchGatedMedia(p.id);
        return { postId: p.id, data };
      }),
    );

    setGatedData((prev) => {
      const next = { ...prev };
      for (const { postId, data } of results) {
        if (data) next[postId] = data;
      }
      return next;
    });
  }, []);

  // Fetch published posts
  const fetchPublished = useCallback(
    async (offset = 0) => {
      const isMore = offset > 0;
      if (isMore) setIsLoadingMore(true);
      else setIsLoadingPublished(true);

      try {
        const params = new URLSearchParams({
          creatorProfileId,
          status: "published",
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });

        const res = await fetch(`/api/posts?${params}`);
        if (!res.ok) throw new Error("Failed to fetch posts");

        const data = await res.json();

        // Fetch full post data with media for each post
        const postsWithMedia = await Promise.all(
          data.posts.map(async (p: PostData) => {
            if ((p.mediaCount ?? 0) > 0 || (p.media && p.media.length > 0)) {
              const postRes = await fetch(`/api/posts/${p.id}`);
              if (postRes.ok) {
                const postData = await postRes.json();
                return postData.post;
              }
            }
            return { ...p, media: [] };
          }),
        );

        if (isMore) {
          setPublishedPosts((prev) => {
            const next = [...prev, ...postsWithMedia];
            // Fetch gated media for the new posts
            fetchGatedMediaForPosts(postsWithMedia);
            return next;
          });
        } else {
          setPublishedPosts(postsWithMedia);
          // Fetch gated media for all posts
          fetchGatedMediaForPosts(postsWithMedia);
        }
        setTotalPublished(data.total);
      } catch (err) {
        console.error("Failed to fetch published posts:", err);
      } finally {
        setIsLoadingPublished(false);
        setIsLoadingMore(false);
      }
    },
    [creatorProfileId, fetchGatedMediaForPosts],
  );

  // Fetch drafts (owner only)
  const fetchDrafts = useCallback(async () => {
    if (!isOwner) return;
    setIsLoadingDrafts(true);

    try {
      const params = new URLSearchParams({
        creatorProfileId,
        status: "draft",
      });

      const res = await fetch(`/api/posts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch drafts");

      const data = await res.json();
      setDrafts(data.posts);
    } catch (err) {
      console.error("Failed to fetch drafts:", err);
    } finally {
      setIsLoadingDrafts(false);
    }
  }, [creatorProfileId, isOwner]);

  // Initial fetch
  useEffect(() => {
    fetchPublished();
    if (isOwner) fetchDrafts();
  }, [fetchPublished, fetchDrafts, isOwner]);

  // Handle new post published
  const handlePublished = useCallback(() => {
    // Refresh both lists
    fetchPublished();
    if (isOwner) fetchDrafts();
  }, [fetchPublished, fetchDrafts, isOwner]);

  const hasMorePublished = publishedPosts.length < totalPublished;

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse space-y-3 rounded-xl border bg-card p-6"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="space-y-1.5">
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="h-2.5 w-16 rounded bg-muted" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-3/4 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );

  // Empty state for published posts
  const PublishedEmpty = () => (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
      <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
      {isOwner ? (
        <>
          <p className="mb-1 text-sm font-medium">Create your first post</p>
          <p className="mb-4 text-xs text-muted-foreground">
            Share updates with your supporters.
          </p>
          <Button size="sm" onClick={() => setComposerOpen(true)}>
            <Plus className="h-4 w-4" />
            New Post
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No posts yet</p>
      )}
    </div>
  );

  // Drafts empty state
  const DraftsEmpty = () => (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
      <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">No drafts</p>
    </div>
  );

  /** Build PostCard props for a post, merging gated data if applicable */
  function renderPostCard(postItem: PostData) {
    const gated = gatedData[postItem.id];
    const isGated = postItem.accessLevel && postItem.accessLevel !== "public";

    // For gated posts, use the gated media data if available
    const postForCard = gated
      ? {
          ...postItem,
          media: gated.media,
          isLocked: gated.isLocked,
        }
      : postItem;

    return (
      <PostCard
        key={postItem.id}
        post={postForCard}
        creatorName={creatorName}
        creatorAvatar={creatorAvatar}
        isOwner={isOwner}
        {...(isGated && gated
          ? {
              tokenTicker: gated.tokenTicker ?? undefined,
              requiredBalance: gated.requiredBalance,
              viewerBalance: gated.viewerBalance,
              creatorTokenId: postItem.creatorTokenId ?? undefined,
            }
          : {})}
      />
    );
  }

  const feedContent = (
    <>
      {isLoadingPublished ? (
        <LoadingSkeleton />
      ) : publishedPosts.length === 0 ? (
        <PublishedEmpty />
      ) : (
        <div className="space-y-4">
          {publishedPosts.map((post) => renderPostCard(post))}

          {hasMorePublished && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => fetchPublished(publishedPosts.length)}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      {/* New Post button for owner */}
      {isOwner && (
        <div className="flex justify-end">
          <Button onClick={() => setComposerOpen(true)}>
            <Plus className="h-4 w-4" />
            New Post
          </Button>
        </div>
      )}

      {/* Tabs for owner (Published + Drafts), just feed for public */}
      {isOwner ? (
        <Tabs defaultValue="published">
          <TabsList>
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="drafts">
              Drafts{drafts.length > 0 && ` (${drafts.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="published">{feedContent}</TabsContent>

          <TabsContent value="drafts">
            {isLoadingDrafts ? (
              <LoadingSkeleton />
            ) : drafts.length === 0 ? (
              <DraftsEmpty />
            ) : (
              <div className="space-y-4">
                {drafts.map((draft) => (
                  <PostCard
                    key={draft.id}
                    post={draft}
                    creatorName={creatorName}
                    creatorAvatar={creatorAvatar}
                    isOwner
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        feedContent
      )}

      {/* Composer modal */}
      <PostComposer
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPublished={handlePublished}
      />
    </div>
  );
}
