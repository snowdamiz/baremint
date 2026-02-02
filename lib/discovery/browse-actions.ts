"use server";

import { db } from "@/lib/db";
import { creatorProfile, creatorToken } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export type CreatorBrowseItem = {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  category: string | null;
  mintAddress: string;
  tickerSymbol: string;
  tokenName: string;
  tokenImageUrl: string | null;
  createdAt: Date;
};

/**
 * Returns a paginated list of creators who have launched tokens and are KYC-approved.
 * Uses the limit+1 trick for hasMore pagination.
 */
export async function getCreatorBrowseFeed(
  limit: number = 20,
  offset: number = 0,
): Promise<{ creators: CreatorBrowseItem[]; hasMore: boolean }> {
  const rows = await db
    .select({
      id: creatorProfile.id,
      displayName: creatorProfile.displayName,
      bio: creatorProfile.bio,
      avatarUrl: creatorProfile.avatarUrl,
      category: creatorProfile.category,
      mintAddress: creatorToken.mintAddress,
      tickerSymbol: creatorToken.tickerSymbol,
      tokenName: creatorToken.tokenName,
      tokenImageUrl: creatorToken.imageUrl,
      createdAt: creatorProfile.createdAt,
    })
    .from(creatorProfile)
    .innerJoin(
      creatorToken,
      eq(creatorToken.creatorProfileId, creatorProfile.id),
    )
    .where(eq(creatorProfile.kycStatus, "approved"))
    .orderBy(desc(creatorProfile.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const creators = hasMore ? rows.slice(0, limit) : rows;

  return { creators, hasMore };
}
