"use server";

import crypto from "node:crypto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import {
  creatorProfile,
  creatorToken,
  donation,
  user,
  wallet,
} from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { sendSolTransfer } from "@/lib/solana/transfer";
import { buildAndSendTokenTransfer } from "@/lib/solana/token-transfer";

// ──────────────────────────────────────────────
// Auth helper
// ──────────────────────────────────────────────

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    throw new Error("Not authenticated");
  }
  return session.user;
}

// ──────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────

const positiveAmountSchema = z.string().refine(
  (val) => {
    try {
      return BigInt(val) > BigInt(0);
    } catch {
      return false;
    }
  },
  { message: "Amount must be a positive integer string" },
);

// ──────────────────────────────────────────────
// Helper: look up creator wallet by mint address
// ──────────────────────────────────────────────

async function getCreatorWalletByMint(mintAddress: string) {
  // creatorToken -> creatorProfile -> user -> wallet
  const rows = await db
    .select({
      creatorProfileId: creatorProfile.id,
      walletPublicKey: wallet.publicKey,
    })
    .from(creatorToken)
    .innerJoin(creatorProfile, eq(creatorToken.creatorProfileId, creatorProfile.id))
    .innerJoin(user, eq(creatorProfile.userId, user.id))
    .innerJoin(wallet, eq(wallet.userId, user.id))
    .where(eq(creatorToken.mintAddress, mintAddress))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

// ──────────────────────────────────────────────
// donateSol -- send SOL tip to creator
// ──────────────────────────────────────────────

export async function donateSol(
  mintAddress: string,
  amountLamports: string,
): Promise<{ success: true; signature: string } | { success: false; error: string }> {
  try {
    const viewer = await getAuthenticatedUser();

    const parsed = positiveAmountSchema.safeParse(amountLamports);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const creator = await getCreatorWalletByMint(mintAddress);
    if (!creator) {
      return { success: false, error: "Creator not found for this token" };
    }

    // Prevent self-tipping
    const viewerWallet = await db.query.wallet.findFirst({
      where: eq(wallet.userId, viewer.id),
    });
    if (viewerWallet?.publicKey === creator.walletPublicKey) {
      return { success: false, error: "Cannot tip yourself" };
    }

    const { signature } = await sendSolTransfer(
      viewer.id,
      creator.walletPublicKey,
      BigInt(amountLamports),
    );

    // Record donation
    await db.insert(donation).values({
      id: crypto.randomUUID(),
      fromUserId: viewer.id,
      toCreatorProfileId: creator.creatorProfileId,
      type: "sol",
      amount: amountLamports,
      mintAddress: null,
      txSignature: signature,
      status: "confirmed",
    });

    return { success: true, signature };
  } catch (error) {
    console.error("donateSol error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "SOL donation failed. Please try again.",
    };
  }
}

// ──────────────────────────────────────────────
// donateToken -- send token tip to creator
// ──────────────────────────────────────────────

export async function donateToken(
  mintAddress: string,
  amount: string,
): Promise<{ success: true; signature: string } | { success: false; error: string }> {
  try {
    const viewer = await getAuthenticatedUser();

    const parsed = positiveAmountSchema.safeParse(amount);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const creator = await getCreatorWalletByMint(mintAddress);
    if (!creator) {
      return { success: false, error: "Creator not found for this token" };
    }

    // Prevent self-tipping
    const viewerWallet = await db.query.wallet.findFirst({
      where: eq(wallet.userId, viewer.id),
    });
    if (viewerWallet?.publicKey === creator.walletPublicKey) {
      return { success: false, error: "Cannot tip yourself" };
    }

    const { signature } = await buildAndSendTokenTransfer(
      viewer.id,
      creator.walletPublicKey,
      mintAddress,
      BigInt(amount),
    );

    // Record donation
    await db.insert(donation).values({
      id: crypto.randomUUID(),
      fromUserId: viewer.id,
      toCreatorProfileId: creator.creatorProfileId,
      type: "token",
      amount,
      mintAddress,
      txSignature: signature,
      status: "confirmed",
    });

    return { success: true, signature };
  } catch (error) {
    console.error("donateToken error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Token donation failed. Please try again.",
    };
  }
}

// ──────────────────────────────────────────────
// getDonationHistory -- recent tips for a creator
// ──────────────────────────────────────────────

export interface DonationRecord {
  id: string;
  fromUserName: string;
  type: string;
  amount: string;
  txSignature: string;
  createdAt: string;
}

export async function getDonationHistory(
  mintAddress: string,
): Promise<DonationRecord[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return [];
  }

  // Look up the creator profile for this mint
  const token = await db.query.creatorToken.findFirst({
    where: eq(creatorToken.mintAddress, mintAddress),
  });
  if (!token) {
    return [];
  }

  const rows = await db
    .select({
      id: donation.id,
      fromUserName: user.name,
      type: donation.type,
      amount: donation.amount,
      txSignature: donation.txSignature,
      createdAt: donation.createdAt,
    })
    .from(donation)
    .innerJoin(user, eq(donation.fromUserId, user.id))
    .where(eq(donation.toCreatorProfileId, token.creatorProfileId))
    .orderBy(desc(donation.createdAt))
    .limit(50);

  return rows.map((row) => ({
    id: row.id,
    fromUserName: row.fromUserName,
    type: row.type,
    amount: row.amount,
    txSignature: row.txSignature,
    createdAt: row.createdAt.toISOString(),
  }));
}
