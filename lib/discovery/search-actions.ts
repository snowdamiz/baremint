"use server";

import { db } from "@/lib/db";
import { creatorProfile, creatorToken } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export type SearchResult = {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  category: string | null;
  mintAddress: string;
  tickerSymbol: string;
  tokenName: string;
  tokenImageUrl: string | null;
};

/**
 * Full-text search for creators by name, bio, and category.
 * Supports prefix matching on the last word for autocomplete-style results.
 */
export async function searchCreators(
  query: string,
  limit: number = 20,
): Promise<SearchResult[]> {
  const sanitized = query.replace(/[^\w\s]/g, "").trim();
  if (!sanitized) return [];

  const words = sanitized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  // All words except last get exact match, last word gets prefix match
  const terms = words.map((word, i) =>
    i < words.length - 1 ? word : `${word}:*`,
  );
  const tsquery = terms.join(" & ");

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
    })
    .from(creatorProfile)
    .innerJoin(
      creatorToken,
      eq(creatorToken.creatorProfileId, creatorProfile.id),
    )
    .where(
      sql`${creatorProfile.searchVector} @@ to_tsquery('simple', ${tsquery}) AND ${creatorProfile.kycStatus} = 'approved'`,
    )
    .orderBy(
      sql`ts_rank(${creatorProfile.searchVector}, to_tsquery('simple', ${tsquery})) DESC`,
    )
    .limit(limit);

  return rows;
}
