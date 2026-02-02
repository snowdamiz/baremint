import { db } from "@/lib/db";
import {
  notification,
  trade,
  creatorToken,
  creatorProfile,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Fan out notifications to all holders of a given token.
 *
 * Deduplicates by txSignature (if provided) to prevent duplicate notifications
 * from webhook retries. Caps at 1000 holders for MVP.
 */
export async function notifyTokenHolders(
  mintAddress: string,
  type: string,
  excludeUserId: string,
  title: string,
  body: string,
  txSignature?: string,
): Promise<void> {
  // Deduplication check
  if (txSignature) {
    const [existing] = await db
      .select({ id: notification.id })
      .from(notification)
      .where(eq(notification.txSignature, txSignature))
      .limit(1);

    if (existing) return;
  }

  // Query distinct holders (users who bought this token with confirmed trades)
  const holders = await db
    .selectDistinct({ userId: trade.userId })
    .from(trade)
    .where(
      and(
        eq(trade.mintAddress, mintAddress),
        eq(trade.type, "buy"),
        eq(trade.status, "confirmed"),
      ),
    )
    .limit(1000);

  // Filter out the user who triggered the event
  const recipientIds = holders
    .map((h) => h.userId)
    .filter((id) => id !== excludeUserId);

  if (recipientIds.length === 0) return;

  const notifications = recipientIds.map((userId) => ({
    id: crypto.randomUUID(),
    userId,
    type,
    title,
    body,
    linkUrl: `/trade/${mintAddress}`,
    relatedMintAddress: mintAddress,
    txSignature: txSignature ?? null,
    isRead: false,
  }));

  await db.insert(notification).values(notifications);
}

/**
 * Notify all token holders when a creator publishes new content.
 *
 * Looks up the creator's token and userId, then delegates to notifyTokenHolders
 * with type "new_content", excluding the creator's own userId.
 */
export async function notifyTokenHoldersByCreator(
  creatorProfileId: string,
  title: string,
  body: string,
  linkUrl: string,
): Promise<void> {
  // Look up the creator's token
  const [token] = await db
    .select({ mintAddress: creatorToken.mintAddress })
    .from(creatorToken)
    .where(eq(creatorToken.creatorProfileId, creatorProfileId))
    .limit(1);

  if (!token) return;

  // Look up the creator's userId
  const [profile] = await db
    .select({ userId: creatorProfile.userId })
    .from(creatorProfile)
    .where(eq(creatorProfile.id, creatorProfileId))
    .limit(1);

  if (!profile) return;

  // Fan out notifications with custom linkUrl
  const holders = await db
    .selectDistinct({ userId: trade.userId })
    .from(trade)
    .where(
      and(
        eq(trade.mintAddress, token.mintAddress),
        eq(trade.type, "buy"),
        eq(trade.status, "confirmed"),
      ),
    )
    .limit(1000);

  const recipientIds = holders
    .map((h) => h.userId)
    .filter((id) => id !== profile.userId);

  if (recipientIds.length === 0) return;

  const notifications = recipientIds.map((userId) => ({
    id: crypto.randomUUID(),
    userId,
    type: "new_content",
    title,
    body,
    linkUrl,
    relatedMintAddress: token.mintAddress,
    txSignature: null,
    isRead: false,
  }));

  await db.insert(notification).values(notifications);
}
