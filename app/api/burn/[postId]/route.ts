import crypto from "node:crypto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { post, creatorToken, contentUnlock } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  readBondingCurveAccount,
  readGlobalConfig,
} from "@/lib/solana/bonding-curve-read";
import {
  calculateTokensForSolValue,
  calculateFee,
} from "@/lib/solana/bonding-curve-math";
import { buildAndSendBurnForAccess } from "@/lib/solana/trade";

/**
 * GET /api/burn/[postId]
 *
 * Returns a burn quote: how many tokens need to be burned to unlock the post,
 * plus fee breakdown. Public endpoint (no auth needed for pricing info).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;

  try {
    // Look up post
    const [postData] = await db
      .select()
      .from(post)
      .where(eq(post.id, postId))
      .limit(1);

    if (!postData) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (!postData.creatorTokenId) {
      return NextResponse.json(
        { error: "Post has no associated token" },
        { status: 400 },
      );
    }

    // Look up creator token for mint address and ticker
    const [token] = await db
      .select()
      .from(creatorToken)
      .where(eq(creatorToken.id, postData.creatorTokenId))
      .limit(1);

    if (!token) {
      return NextResponse.json(
        { error: "Creator token not found" },
        { status: 404 },
      );
    }

    // Read on-chain state
    const bondingCurve = await readBondingCurveAccount(token.mintAddress);

    if (bondingCurve.burnSolPrice === BigInt(0)) {
      return NextResponse.json(
        { error: "Burn is disabled for this token" },
        { status: 400 },
      );
    }

    // Calculate tokens required
    const tokensRequired = calculateTokensForSolValue(
      bondingCurve.virtualSolReserves,
      bondingCurve.virtualTokenReserves,
      bondingCurve.burnSolPrice,
    );

    // Calculate fee breakdown
    const globalConfig = await readGlobalConfig();
    const totalFee = calculateFee(bondingCurve.burnSolPrice, globalConfig.feeBps);
    const platformFee = totalFee / BigInt(2);
    const creatorFee = totalFee - platformFee;

    return NextResponse.json({
      tokensRequired: tokensRequired.toString(),
      burnSolPrice: bondingCurve.burnSolPrice.toString(),
      totalFee: totalFee.toString(),
      platformFee: platformFee.toString(),
      creatorFee: creatorFee.toString(),
      tokenTicker: token.tickerSymbol,
      mintAddress: token.mintAddress,
    });
  } catch (error) {
    console.error("Burn quote error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get burn quote",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/burn/[postId]
 *
 * Executes a burn-to-unlock transaction. Requires authentication.
 * On success, creates a permanent content_unlock record so the viewer
 * never needs to burn again for this post.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;

  // Authenticate
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Look up post
    const [postData] = await db
      .select()
      .from(post)
      .where(eq(post.id, postId))
      .limit(1);

    if (!postData) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (postData.accessLevel !== "burn_gated") {
      return NextResponse.json(
        { error: "Post is not burn-gated" },
        { status: 400 },
      );
    }

    if (!postData.creatorTokenId) {
      return NextResponse.json(
        { error: "Post has no associated token" },
        { status: 400 },
      );
    }

    // Check if already unlocked
    const [existingUnlock] = await db
      .select()
      .from(contentUnlock)
      .where(
        and(
          eq(contentUnlock.userId, userId),
          eq(contentUnlock.postId, postId),
        ),
      )
      .limit(1);

    if (existingUnlock) {
      return NextResponse.json(
        { error: "Already unlocked" },
        { status: 400 },
      );
    }

    // Look up creator token for mint address
    const [token] = await db
      .select()
      .from(creatorToken)
      .where(eq(creatorToken.id, postData.creatorTokenId))
      .limit(1);

    if (!token) {
      return NextResponse.json(
        { error: "Creator token not found" },
        { status: 404 },
      );
    }

    // Execute burn transaction
    const result = await buildAndSendBurnForAccess(userId, token.mintAddress);

    // Create permanent unlock record
    await db.insert(contentUnlock).values({
      id: crypto.randomUUID(),
      userId,
      postId,
      txSignature: result.signature,
      tokensBurned: result.tokensBurned.toString(),
    });

    return NextResponse.json({
      success: true,
      signature: result.signature,
      tokensBurned: result.tokensBurned.toString(),
    });
  } catch (error) {
    console.error("Burn execution error:", error);

    const message =
      error instanceof Error ? error.message : "Burn transaction failed";

    // Map known errors to user-friendly messages
    if (message.includes("Insufficient")) {
      return NextResponse.json(
        { error: "Insufficient token balance to burn" },
        { status: 400 },
      );
    }

    if (message.includes("disabled")) {
      return NextResponse.json(
        { error: "Burn is disabled for this token" },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
