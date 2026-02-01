import crypto from "node:crypto";
import { db } from "@/lib/db";
import {
  moderationAction,
  media,
  post,
  creatorProfile,
  creatorStrike,
} from "@/lib/db/schema";
import { eq, and, isNull, count, desc, gte } from "drizzle-orm";

// ──────────────────────────────────────────────
// Moderation queue
// ──────────────────────────────────────────────

/**
 * Get unreviewed moderation actions (flagged content awaiting review).
 * Returns flagged items with creator info, media details, and post content.
 * Ordered by createdAt ascending (oldest first).
 */
export async function getModerQueue(limit: number, offset: number) {
  const items = await db
    .select({
      id: moderationAction.id,
      mediaId: moderationAction.mediaId,
      postId: moderationAction.postId,
      action: moderationAction.action,
      reason: moderationAction.reason,
      confidence: moderationAction.confidence,
      createdAt: moderationAction.createdAt,
      // Media fields
      mediaType: media.type,
      mediaStatus: media.status,
      mediaOriginalKey: media.originalKey,
      mediaVariants: media.variants,
      mediaMimeType: media.mimeType,
      // Post fields
      postContent: post.content,
      postStatus: post.status,
      // Creator fields
      creatorProfileId: creatorProfile.id,
      creatorDisplayName: creatorProfile.displayName,
      creatorAvatarUrl: creatorProfile.avatarUrl,
    })
    .from(moderationAction)
    .leftJoin(media, eq(media.id, moderationAction.mediaId))
    .leftJoin(post, eq(post.id, moderationAction.postId))
    .leftJoin(creatorProfile, eq(creatorProfile.id, post.creatorProfileId))
    .where(
      and(
        eq(moderationAction.action, "flag_csam"),
        isNull(moderationAction.reviewedAt),
      ),
    )
    .orderBy(moderationAction.createdAt)
    .limit(limit)
    .offset(offset);

  // Get total count of pending items
  const [{ total }] = await db
    .select({ total: count() })
    .from(moderationAction)
    .where(
      and(
        eq(moderationAction.action, "flag_csam"),
        isNull(moderationAction.reviewedAt),
      ),
    );

  // For each item, get the creator's current strike count
  const itemsWithStrikes = await Promise.all(
    items.map(async (item) => {
      let strikeCount = 0;
      if (item.creatorProfileId) {
        const [{ total: strikes }] = await db
          .select({ total: count() })
          .from(creatorStrike)
          .where(eq(creatorStrike.creatorProfileId, item.creatorProfileId));
        strikeCount = strikes;
      }
      return { ...item, creatorStrikeCount: strikeCount };
    }),
  );

  return { items: itemsWithStrikes, total };
}

// ──────────────────────────────────────────────
// Review actions
// ──────────────────────────────────────────────

/**
 * Approve flagged content. Restores media to "ready" and
 * transitions post back to "published" if all media is now ready.
 */
export async function approveContent(
  moderationActionId: string,
  adminUserId: string,
) {
  // Update the moderation action
  const [updated] = await db
    .update(moderationAction)
    .set({
      action: "approve",
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
    })
    .where(eq(moderationAction.id, moderationActionId))
    .returning();

  if (!updated) return null;

  // Restore media status from "flagged" to "ready"
  if (updated.mediaId) {
    await db
      .update(media)
      .set({ status: "ready" })
      .where(
        and(eq(media.id, updated.mediaId), eq(media.status, "flagged")),
      );
  }

  // If the post was under_review, check if all media is now ready
  if (updated.postId) {
    const postRecord = await db.query.post.findFirst({
      where: eq(post.id, updated.postId),
    });

    if (postRecord && postRecord.status === "under_review") {
      const mediaRecords = await db
        .select({ status: media.status })
        .from(media)
        .where(eq(media.postId, updated.postId));

      const allReady = mediaRecords.every((m) => m.status === "ready");
      if (allReady) {
        await db
          .update(post)
          .set({
            status: "published",
            publishedAt: postRecord.publishedAt ?? new Date(),
            updatedAt: new Date(),
          })
          .where(eq(post.id, updated.postId));
      }
    }
  }

  return updated;
}

/**
 * Reject flagged content. Marks media as "failed", post as "removed",
 * and issues a strike against the creator.
 */
export async function rejectContent(
  moderationActionId: string,
  adminUserId: string,
  reason: string,
) {
  // Update the moderation action
  const [updated] = await db
    .update(moderationAction)
    .set({
      action: "reject",
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
    })
    .where(eq(moderationAction.id, moderationActionId))
    .returning();

  if (!updated) return null;

  // Mark media as failed (cannot be recovered)
  if (updated.mediaId) {
    await db
      .update(media)
      .set({ status: "failed" })
      .where(eq(media.id, updated.mediaId));
  }

  // Mark post as removed
  if (updated.postId) {
    await db
      .update(post)
      .set({ status: "removed", updatedAt: new Date() })
      .where(eq(post.id, updated.postId));
  }

  // Issue strike to the creator
  let strike = null;
  if (updated.postId) {
    const postRecord = await db.query.post.findFirst({
      where: eq(post.id, updated.postId),
    });

    if (postRecord) {
      strike = await issueStrike(
        postRecord.creatorProfileId,
        moderationActionId,
        reason,
      );
    }
  }

  return { moderationAction: updated, strike };
}

// ──────────────────────────────────────────────
// Strike system
// ──────────────────────────────────────────────

/**
 * Issue a strike against a creator.
 * 3-strike system:
 *   Strike 1: warning (post removed, creator notified)
 *   Strike 2: restriction (7-day posting restriction)
 *   Strike 3: suspension (account suspended)
 */
export async function issueStrike(
  creatorProfileId: string,
  moderationActionId: string,
  reason: string,
) {
  // Count existing strikes
  const [{ total: existingCount }] = await db
    .select({ total: count() })
    .from(creatorStrike)
    .where(eq(creatorStrike.creatorProfileId, creatorProfileId));

  const strikeNumber = existingCount + 1;

  // Determine consequence
  let consequence: string;
  if (strikeNumber >= 3) {
    consequence = "suspension";
  } else if (strikeNumber === 2) {
    consequence = "restriction";
  } else {
    consequence = "warning";
  }

  // Create strike record
  const [strike] = await db
    .insert(creatorStrike)
    .values({
      id: crypto.randomUUID(),
      creatorProfileId,
      moderationActionId,
      strikeNumber,
      consequence,
      reason,
    })
    .returning();

  // Apply consequence
  if (consequence === "suspension") {
    // Suspend the creator account via kycStatus
    await db
      .update(creatorProfile)
      .set({
        kycStatus: "suspended",
        updatedAt: new Date(),
      })
      .where(eq(creatorProfile.id, creatorProfileId));
  }

  return strike;
}

/**
 * Get all strikes for a creator, ordered by creation date.
 */
export async function getCreatorStrikes(creatorProfileId: string) {
  return db
    .select()
    .from(creatorStrike)
    .where(eq(creatorStrike.creatorProfileId, creatorProfileId))
    .orderBy(creatorStrike.createdAt);
}

/**
 * Check if a creator is restricted from posting.
 * - Strike 2 within last 7 days: posting restriction active
 * - Strike 3+: account suspended (kycStatus = "suspended")
 */
export async function isCreatorRestricted(creatorProfileId: string): Promise<{
  restricted: boolean;
  reason: "none" | "restriction" | "suspension";
}> {
  // Check for suspension first (most severe)
  const profile = await db.query.creatorProfile.findFirst({
    where: eq(creatorProfile.id, creatorProfileId),
  });

  if (profile?.kycStatus === "suspended") {
    return { restricted: true, reason: "suspension" };
  }

  // Check for active restriction (strike 2 within last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentRestriction = await db
    .select()
    .from(creatorStrike)
    .where(
      and(
        eq(creatorStrike.creatorProfileId, creatorProfileId),
        eq(creatorStrike.consequence, "restriction"),
        gte(creatorStrike.createdAt, sevenDaysAgo),
      ),
    )
    .limit(1);

  if (recentRestriction.length > 0) {
    return { restricted: true, reason: "restriction" };
  }

  return { restricted: false, reason: "none" };
}
