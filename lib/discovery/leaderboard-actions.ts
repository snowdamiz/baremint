"use server";

import { db } from "@/lib/db";
import { creatorToken, creatorProfile, trade } from "@/lib/db/schema";
import { sql, eq, desc } from "drizzle-orm";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface LeaderboardItem {
  tokenId: string;
  mintAddress: string;
  tokenName: string;
  tickerSymbol: string;
  imageUrl: string | null;
  creatorName: string;
  creatorAvatarUrl: string | null;
  creatorProfileId: string;
  launchedAt: string;
  volume24h: string; // lamports as string
  tradeCount: number;
}

// ──────────────────────────────────────────────
// getLeaderboard — public, no auth required
// ──────────────────────────────────────────────

export async function getLeaderboard(
  sortBy: "volume_24h" | "newest" = "volume_24h",
  limit: number = 50,
  offset: number = 0,
): Promise<{ tokens: LeaderboardItem[]; hasMore: boolean }> {
  try {
    // Subquery: aggregate 24h volume from confirmed trades
    const volumeSubquery = db
      .select({
        creatorTokenId: trade.creatorTokenId,
        volume24h:
          sql<string>`COALESCE(SUM(CAST(${trade.solAmount} AS NUMERIC)), 0)`.as(
            "volume_24h",
          ),
        tradeCount: sql<number>`COUNT(*)::int`.as("trade_count"),
      })
      .from(trade)
      .where(
        sql`${trade.status} = 'confirmed' AND ${trade.confirmedAt} > NOW() - INTERVAL '24 hours'`,
      )
      .groupBy(trade.creatorTokenId)
      .as("volume_stats");

    // Main query: join creatorToken + creatorProfile + volume stats
    const orderByClause =
      sortBy === "newest"
        ? desc(creatorToken.launchedAt)
        : sql`COALESCE(${volumeSubquery.volume24h}, '0') DESC`;

    const rows = await db
      .select({
        tokenId: creatorToken.id,
        mintAddress: creatorToken.mintAddress,
        tokenName: creatorToken.tokenName,
        tickerSymbol: creatorToken.tickerSymbol,
        imageUrl: creatorToken.imageUrl,
        creatorName: creatorProfile.displayName,
        creatorAvatarUrl: creatorProfile.avatarUrl,
        creatorProfileId: creatorProfile.id,
        launchedAt: creatorToken.launchedAt,
        volume24h: volumeSubquery.volume24h,
        tradeCount: volumeSubquery.tradeCount,
      })
      .from(creatorToken)
      .innerJoin(
        creatorProfile,
        eq(creatorToken.creatorProfileId, creatorProfile.id),
      )
      .leftJoin(
        volumeSubquery,
        eq(creatorToken.id, volumeSubquery.creatorTokenId),
      )
      .orderBy(orderByClause)
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const tokens: LeaderboardItem[] = rows.slice(0, limit).map((row) => ({
      tokenId: row.tokenId,
      mintAddress: row.mintAddress,
      tokenName: row.tokenName,
      tickerSymbol: row.tickerSymbol,
      imageUrl: row.imageUrl,
      creatorName: row.creatorName,
      creatorAvatarUrl: row.creatorAvatarUrl,
      creatorProfileId: row.creatorProfileId,
      launchedAt: row.launchedAt.toISOString(),
      volume24h: row.volume24h ?? "0",
      tradeCount: row.tradeCount ?? 0,
    }));

    return { tokens, hasMore };
  } catch (error) {
    console.error("getLeaderboard error:", error);
    return { tokens: [], hasMore: false };
  }
}
