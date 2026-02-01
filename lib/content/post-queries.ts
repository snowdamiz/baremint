import crypto from "node:crypto";
import { db } from "@/lib/db";
import { post, media } from "@/lib/db/schema";
import { eq, and, desc, count, inArray, ne } from "drizzle-orm";

/**
 * Create a new draft post for a creator.
 */
export async function createDraftPost(
  creatorProfileId: string,
  content?: string,
) {
  const [newPost] = await db
    .insert(post)
    .values({
      id: crypto.randomUUID(),
      creatorProfileId,
      content: content ?? null,
      status: "draft",
    })
    .returning();

  return newPost;
}

/**
 * Update a draft post's content. Only works on drafts owned by the creator.
 * Returns the updated post or null if not found/not a draft/not owned.
 */
export async function updateDraftPost(
  postId: string,
  creatorProfileId: string,
  content: string,
) {
  const [updated] = await db
    .update(post)
    .set({
      content,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(post.id, postId),
        eq(post.creatorProfileId, creatorProfileId),
        eq(post.status, "draft"),
      ),
    )
    .returning();

  return updated ?? null;
}

/**
 * Update a published post's text content. Only text is editable (not media).
 * Cannot edit posts that are under_review or removed.
 * Returns the updated post or null if not found/not editable/not owned.
 */
export async function updatePublishedPost(
  postId: string,
  creatorProfileId: string,
  content: string,
) {
  const [updated] = await db
    .update(post)
    .set({
      content,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(post.id, postId),
        eq(post.creatorProfileId, creatorProfileId),
        inArray(post.status, ["draft", "published"]),
      ),
    )
    .returning();

  return updated ?? null;
}

/**
 * Publish a post. Text-only posts transition directly to "published".
 * Posts with media transition to "processing" unless all media is "ready".
 * Only works on drafts owned by the creator.
 *
 * For gated posts, accessLevel, tokenThreshold, and creatorTokenId are stored.
 */
export async function publishPost(
  postId: string,
  creatorProfileId: string,
  options?: {
    accessLevel?: "public" | "hold_gated" | "burn_gated";
    tokenThreshold?: string | null;
    creatorTokenId?: string | null;
  },
) {
  // Verify ownership and draft status
  const existing = await db.query.post.findFirst({
    where: and(
      eq(post.id, postId),
      eq(post.creatorProfileId, creatorProfileId),
      eq(post.status, "draft"),
    ),
  });

  if (!existing) return null;

  // Check for attached media
  const mediaRecords = await db
    .select()
    .from(media)
    .where(eq(media.postId, postId));

  let newStatus: string;

  if (mediaRecords.length === 0) {
    // Text-only post -- publish immediately
    newStatus = "published";
  } else {
    // Post with media -- check if all media is ready
    const allReady = mediaRecords.every((m) => m.status === "ready");
    newStatus = allReady ? "published" : "processing";
  }

  const now = new Date();
  const accessLevel = options?.accessLevel ?? "public";
  const [updated] = await db
    .update(post)
    .set({
      status: newStatus,
      accessLevel,
      tokenThreshold: accessLevel !== "public" ? (options?.tokenThreshold ?? null) : null,
      creatorTokenId: accessLevel !== "public" ? (options?.creatorTokenId ?? null) : null,
      publishedAt: newStatus === "published" ? now : null,
      updatedAt: now,
    })
    .where(eq(post.id, postId))
    .returning();

  return updated ?? null;
}

/**
 * Get published posts for a creator profile, ordered by publishedAt desc.
 */
export async function getPublishedPosts(
  creatorProfileId: string,
  limit: number,
  offset: number,
) {
  const posts = await db
    .select({
      id: post.id,
      creatorProfileId: post.creatorProfileId,
      content: post.content,
      status: post.status,
      accessLevel: post.accessLevel,
      tokenThreshold: post.tokenThreshold,
      creatorTokenId: post.creatorTokenId,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      mediaCount: count(media.id),
    })
    .from(post)
    .leftJoin(media, eq(media.postId, post.id))
    .where(
      and(
        eq(post.creatorProfileId, creatorProfileId),
        eq(post.status, "published"),
      ),
    )
    .groupBy(post.id)
    .orderBy(desc(post.publishedAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [{ total }] = await db
    .select({ total: count() })
    .from(post)
    .where(
      and(
        eq(post.creatorProfileId, creatorProfileId),
        eq(post.status, "published"),
      ),
    );

  return { posts, total };
}

/**
 * Get draft posts for a creator profile, ordered by updatedAt desc.
 */
export async function getCreatorDrafts(creatorProfileId: string) {
  return db
    .select()
    .from(post)
    .where(
      and(
        eq(post.creatorProfileId, creatorProfileId),
        eq(post.status, "draft"),
      ),
    )
    .orderBy(desc(post.updatedAt));
}

/**
 * Get a single post by ID with its media records.
 */
export async function getPostById(postId: string) {
  const postRecord = await db.query.post.findFirst({
    where: eq(post.id, postId),
  });

  if (!postRecord) return null;

  const mediaRecords = await db
    .select()
    .from(media)
    .where(eq(media.postId, postId))
    .orderBy(media.sortOrder);

  return { ...postRecord, media: mediaRecords };
}

/**
 * Soft-delete a post by setting status to "removed".
 * Only works if the creator owns the post.
 * Also marks all attached media as "failed" to prevent public access.
 * Does NOT hard-delete media from R2 for legal compliance.
 */
export async function deletePost(postId: string, creatorProfileId: string) {
  const [updated] = await db
    .update(post)
    .set({
      status: "removed",
      updatedAt: new Date(),
    })
    .where(
      and(eq(post.id, postId), eq(post.creatorProfileId, creatorProfileId)),
    )
    .returning();

  if (!updated) return null;

  // Mark all attached media as failed so they are not publicly queryable
  await db
    .update(media)
    .set({ status: "failed" })
    .where(
      and(eq(media.postId, postId), ne(media.status, "failed")),
    );

  return updated;
}
