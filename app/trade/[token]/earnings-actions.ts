"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { creatorProfile, creatorToken, trade, contentUnlock, post } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  readBondingCurveAccount,
  readGlobalConfig,
} from "@/lib/solana/bonding-curve-read";
import {
  readVestingAccount,
  calculateClaimable,
} from "@/lib/solana/vesting-read";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CreatorEarningsData {
  tradeFeeRevenue: string; // lamports as string (creator's 50% share of trade fees)
  burnCount: number; // number of burn-to-unlock events
  currentAccruedFees: string; // lamports as string (on-chain creatorFeesAccrued)
  vesting: {
    total: string; // raw tokens as string
    claimed: string; // raw tokens as string
    claimable: string; // raw tokens as string
    isRevoked: boolean;
    startTimestamp: string; // unix seconds as string
    nextClaimDate: string | null; // ISO string or null if fully vested/revoked
  } | null; // null if no vesting account found
}

// ──────────────────────────────────────────────
// getCreatorEarnings
// ──────────────────────────────────────────────

export async function getCreatorEarnings(
  mintAddress: string,
): Promise<{ success: true; data: CreatorEarningsData } | { success: false; error: string }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify the caller owns this token's creator profile
  const profile = await db.query.creatorProfile.findFirst({
    where: eq(creatorProfile.userId, session.user.id),
  });

  if (!profile) {
    return { success: false, error: "No creator profile found" };
  }

  const token = await db.query.creatorToken.findFirst({
    where: and(
      eq(creatorToken.creatorProfileId, profile.id),
      eq(creatorToken.mintAddress, mintAddress),
    ),
  });

  if (!token) {
    return { success: false, error: "Token not found or not owned by you" };
  }

  try {
    // Run SQL queries and on-chain reads in parallel
    const [tradeFeeResult, burnCountResult, onChainData] = await Promise.all([
      // Trade fee revenue: creator gets 50% of total fee
      db
        .select({
          totalCreatorFee: sql<string>`COALESCE(SUM(CAST(${trade.feeAmount} AS NUMERIC) / 2), 0)`,
        })
        .from(trade)
        .where(
          and(
            eq(trade.mintAddress, mintAddress),
            eq(trade.status, "confirmed"),
          ),
        ),

      // Burn count: number of content unlocks for this creator's posts
      db
        .select({
          count: sql<string>`COUNT(*)`,
        })
        .from(contentUnlock)
        .innerJoin(post, eq(contentUnlock.postId, post.id))
        .where(eq(post.creatorProfileId, profile.id)),

      // On-chain reads: bonding curve + vesting + global config
      (async () => {
        const [bondingCurve, vesting, globalConfig] = await Promise.all([
          readBondingCurveAccount(mintAddress),
          readVestingAccount(mintAddress),
          readGlobalConfig(),
        ]);
        return { bondingCurve, vesting, globalConfig };
      })(),
    ]);

    const tradeFeeRevenue = Math.floor(
      Number(tradeFeeResult[0].totalCreatorFee),
    ).toString();

    const burnCount = Number(burnCountResult[0].count);

    const currentAccruedFees =
      onChainData.bondingCurve.creatorFeesAccrued.toString();

    // Build vesting data
    let vestingData: CreatorEarningsData["vesting"] = null;

    if (onChainData.vesting) {
      const claimable = calculateClaimable(
        onChainData.vesting,
        onChainData.globalConfig,
      );

      // Calculate next claim date
      let nextClaimDate: string | null = null;
      if (
        !onChainData.vesting.isRevoked &&
        onChainData.vesting.claimedAmount < onChainData.vesting.totalAllocation
      ) {
        const now = BigInt(Math.floor(Date.now() / 1000));
        const cliffEnd =
          onChainData.vesting.startTimestamp +
          onChainData.globalConfig.vestingCliffSeconds;

        if (now < cliffEnd) {
          // Before cliff: next date is cliff end + one interval
          const nextTimestamp =
            cliffEnd + onChainData.globalConfig.vestingClaimIntervalSeconds;
          nextClaimDate = new Date(
            Number(nextTimestamp) * 1000,
          ).toISOString();
        } else {
          // After cliff: find next weekly boundary
          const elapsed = now - cliffEnd;
          const intervalsElapsed =
            elapsed / onChainData.globalConfig.vestingClaimIntervalSeconds;
          const nextIntervalStart =
            cliffEnd +
            (intervalsElapsed + BigInt(1)) *
              onChainData.globalConfig.vestingClaimIntervalSeconds;

          // Only show next date if within vesting duration
          const vestingEnd =
            cliffEnd + onChainData.globalConfig.vestingDurationSeconds;
          if (nextIntervalStart <= vestingEnd) {
            nextClaimDate = new Date(
              Number(nextIntervalStart) * 1000,
            ).toISOString();
          }
        }
      }

      vestingData = {
        total: onChainData.vesting.totalAllocation.toString(),
        claimed: onChainData.vesting.claimedAmount.toString(),
        claimable: claimable.toString(),
        isRevoked: onChainData.vesting.isRevoked,
        startTimestamp: onChainData.vesting.startTimestamp.toString(),
        nextClaimDate,
      };
    }

    return {
      success: true,
      data: {
        tradeFeeRevenue,
        burnCount,
        currentAccruedFees,
        vesting: vestingData,
      },
    };
  } catch (error) {
    console.error("getCreatorEarnings error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch earnings data",
    };
  }
}
