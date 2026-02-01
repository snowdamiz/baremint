import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wallet, creatorToken } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCachedTokenBalance } from "@/lib/content/access-control";

/**
 * GET /api/token-balance?creatorTokenId=xxx
 *
 * Returns the viewer's cached token balance for a specific creator token.
 * Used by the unlock dialog to show current balance vs required threshold.
 *
 * Requires authentication.
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const creatorTokenId = searchParams.get("creatorTokenId");

  if (!creatorTokenId) {
    return NextResponse.json(
      { error: "creatorTokenId is required" },
      { status: 400 },
    );
  }

  // Look up viewer's wallet
  const [viewerWallet] = await db
    .select()
    .from(wallet)
    .where(eq(wallet.userId, session.user.id))
    .limit(1);

  if (!viewerWallet) {
    return NextResponse.json({
      balance: "0",
      mintAddress: null,
    });
  }

  // Look up creator token for mint address
  const [token] = await db
    .select()
    .from(creatorToken)
    .where(eq(creatorToken.id, creatorTokenId))
    .limit(1);

  if (!token) {
    return NextResponse.json(
      { error: "Creator token not found" },
      { status: 404 },
    );
  }

  // Get cached balance
  const balance = await getCachedTokenBalance(
    viewerWallet.publicKey,
    token.mintAddress,
  );

  return NextResponse.json({
    balance: balance.toString(),
    mintAddress: token.mintAddress,
  });
}
