import { db } from "@/lib/db";
import { tokenBalanceCache, creatorToken, contentUnlock } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getTokenBalance } from "@/lib/solana/token-balance";
import crypto from "node:crypto";

/** Cache TTL: 60 seconds */
const BALANCE_CACHE_TTL_MS = 60_000;

/**
 * Get token balance for a wallet+mint pair, with database-backed caching.
 *
 * On cache hit (within TTL), returns the cached balance immediately.
 * On cache miss or stale entry, fetches fresh balance from Helius RPC
 * and upserts into the cache table.
 *
 * @param walletAddress - Solana wallet public key
 * @param mintAddress - SPL token mint address
 * @returns Token balance as BigInt
 */
export async function getCachedTokenBalance(
  walletAddress: string,
  mintAddress: string,
): Promise<bigint> {
  // Check cache
  const [cached] = await db
    .select()
    .from(tokenBalanceCache)
    .where(
      and(
        eq(tokenBalanceCache.walletAddress, walletAddress),
        eq(tokenBalanceCache.mintAddress, mintAddress),
      ),
    )
    .limit(1);

  if (cached) {
    const age = Date.now() - cached.checkedAt.getTime();
    if (age < BALANCE_CACHE_TTL_MS) {
      return BigInt(cached.balance);
    }
  }

  // Cache miss or stale -- fetch fresh balance
  const freshBalance = await getTokenBalance(walletAddress, mintAddress);
  const now = new Date();

  // Upsert into cache (insert or update on conflict)
  await db
    .insert(tokenBalanceCache)
    .values({
      id: cached?.id ?? crypto.randomUUID(),
      walletAddress,
      mintAddress,
      balance: freshBalance.toString(),
      checkedAt: now,
    })
    .onConflictDoUpdate({
      target: [tokenBalanceCache.walletAddress, tokenBalanceCache.mintAddress],
      set: {
        balance: freshBalance.toString(),
        checkedAt: now,
      },
    });

  return freshBalance;
}

/**
 * Check whether a viewer has a permanent burn unlock record for a post.
 */
export async function checkBurnUnlock(
  userId: string,
  postId: string,
): Promise<boolean> {
  const [unlock] = await db
    .select()
    .from(contentUnlock)
    .where(
      and(
        eq(contentUnlock.userId, userId),
        eq(contentUnlock.postId, postId),
      ),
    )
    .limit(1);
  return !!unlock;
}

/**
 * Check whether a viewer has access to a gated post.
 *
 * Access rules:
 * - "public" posts: everyone has access
 * - "burn_gated" posts: first check permanent unlock record, then fall through to balance check
 * - "hold_gated" / "burn_gated" posts: viewer must hold >= tokenThreshold of the creator's token
 * - No wallet connected: no access to gated content (unless burn-unlocked)
 *
 * @param postData - Post access configuration
 * @param viewerWalletPublicKey - Viewer's connected wallet (null if not connected)
 * @param options - Optional viewer identity for burn unlock checks (backward-compatible)
 * @returns Whether the viewer has access and their current balance
 */
export async function checkContentAccess(
  postData: {
    accessLevel: string;
    tokenThreshold: string | null;
    creatorTokenId: string | null;
  },
  viewerWalletPublicKey: string | null,
  options: { viewerUserId?: string; postId?: string } = {},
): Promise<{ hasAccess: boolean; viewerBalance: string }> {
  // Public posts are always accessible
  if (postData.accessLevel === "public") {
    return { hasAccess: true, viewerBalance: "0" };
  }

  // For burn_gated posts: check permanent unlock record first
  if (
    postData.accessLevel === "burn_gated" &&
    options.viewerUserId &&
    options.postId
  ) {
    const hasUnlock = await checkBurnUnlock(
      options.viewerUserId,
      options.postId,
    );
    if (hasUnlock) {
      return { hasAccess: true, viewerBalance: "0" };
    }
  }

  // Gated post but no wallet connected
  if (!viewerWalletPublicKey) {
    return { hasAccess: false, viewerBalance: "0" };
  }

  // Gated post but no token configured (shouldn't happen, but defensive)
  if (!postData.creatorTokenId) {
    return { hasAccess: false, viewerBalance: "0" };
  }

  // Look up the creator token to get the mint address
  const [token] = await db
    .select()
    .from(creatorToken)
    .where(eq(creatorToken.id, postData.creatorTokenId))
    .limit(1);

  if (!token) {
    return { hasAccess: false, viewerBalance: "0" };
  }

  // Check viewer's token balance (with caching)
  const balance = await getCachedTokenBalance(
    viewerWalletPublicKey,
    token.mintAddress,
  );

  const threshold = BigInt(postData.tokenThreshold ?? "0");
  const hasAccess = balance >= threshold;

  return {
    hasAccess,
    viewerBalance: balance.toString(),
  };
}
