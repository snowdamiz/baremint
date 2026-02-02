"use server";

import crypto from "node:crypto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { creatorToken, trade } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { buildAndSendBuy, buildAndSendSell } from "@/lib/solana/trade";
import {
  readBondingCurveAccount,
  readGlobalConfig,
} from "@/lib/solana/bonding-curve-read";
import {
  estimateBuy,
  estimateSell,
  calculatePricePerToken,
} from "@/lib/solana/bonding-curve-math";

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
// Validation schemas
// ──────────────────────────────────────────────

const quoteSchema = z.object({
  mintAddress: z.string().min(1, "Mint address is required"),
  side: z.enum(["buy", "sell"]),
  amount: z.string().refine(
    (val) => {
      try {
        return BigInt(val) > BigInt(0);
      } catch {
        return false;
      }
    },
    { message: "Amount must be a positive integer string" },
  ),
});

const buySchema = z.object({
  mintAddress: z.string().min(1, "Mint address is required"),
  solAmount: z.string().refine(
    (val) => {
      try {
        return BigInt(val) > BigInt(0);
      } catch {
        return false;
      }
    },
    { message: "SOL amount must be a positive integer string" },
  ),
  slippageBps: z.number().int().min(0).max(10000),
});

const sellSchema = z.object({
  mintAddress: z.string().min(1, "Mint address is required"),
  tokenAmount: z.string().refine(
    (val) => {
      try {
        return BigInt(val) > BigInt(0);
      } catch {
        return false;
      }
    },
    { message: "Token amount must be a positive integer string" },
  ),
  slippageBps: z.number().int().min(0).max(10000),
});

// ──────────────────────────────────────────────
// Helper to stringify BigInt values for JSON
// ──────────────────────────────────────────────

function stringifyBigInts<T extends Record<string, unknown>>(
  obj: T,
): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "bigint") {
      result[key] = value.toString();
    } else if (typeof value === "number") {
      result[key] = value;
    } else {
      result[key] = value as string | null;
    }
  }
  return result;
}

// ──────────────────────────────────────────────
// getQuote — public, no auth required
// ──────────────────────────────────────────────

export async function getQuote(
  mintAddress: string,
  side: "buy" | "sell",
  amount: string,
) {
  const parsed = quoteSchema.safeParse({ mintAddress, side, amount });
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }

  try {
    const bondingCurve = await readBondingCurveAccount(mintAddress);
    const globalConfig = await readGlobalConfig();
    const amountBig = BigInt(amount);

    // Spot price before trade
    const spotPrice = calculatePricePerToken(
      bondingCurve.virtualSolReserves,
      bondingCurve.virtualTokenReserves,
    );

    if (side === "buy") {
      const est = estimateBuy(
        amountBig,
        globalConfig.feeBps,
        bondingCurve.virtualSolReserves,
        bondingCurve.virtualTokenReserves,
      );

      // Effective price per token after trade
      const effectivePriceNum = est.solIntoCurve;
      const effectivePriceDenom =
        est.tokensOut > BigInt(0) ? est.tokensOut : BigInt(1);

      // Price impact in bps: |effectivePrice - spotPrice| / spotPrice * 10000
      // Cross-multiply to avoid floats:
      // impact = (effectivePriceNum * spotPrice.priceDenom - spotPrice.priceNum * effectivePriceDenom) * 10000
      //        / (spotPrice.priceNum * effectivePriceDenom)
      let priceImpactBps = 0;
      if (spotPrice.priceNum > BigInt(0) && effectivePriceDenom > BigInt(0)) {
        const cross1 = effectivePriceNum * spotPrice.priceDenom;
        const cross2 = spotPrice.priceNum * effectivePriceDenom;
        const diff = cross1 > cross2 ? cross1 - cross2 : cross2 - cross1;
        priceImpactBps = Number(
          (diff * BigInt(10000)) / (spotPrice.priceNum * effectivePriceDenom),
        );
      }

      return {
        success: true as const,
        data: {
          ...stringifyBigInts(est),
          pricePerToken: `${spotPrice.priceNum.toString()}/${spotPrice.priceDenom.toString()}`,
          priceImpactBps,
        },
      };
    } else {
      const est = estimateSell(
        amountBig,
        globalConfig.feeBps,
        bondingCurve.virtualSolReserves,
        bondingCurve.virtualTokenReserves,
      );

      // Effective price per token for sell
      const effectivePriceNum = est.grossSol;
      const effectivePriceDenom = amountBig > BigInt(0) ? amountBig : BigInt(1);

      let priceImpactBps = 0;
      if (spotPrice.priceNum > BigInt(0) && effectivePriceDenom > BigInt(0)) {
        const cross1 = spotPrice.priceNum * effectivePriceDenom;
        const cross2 = effectivePriceNum * spotPrice.priceDenom;
        const diff = cross1 > cross2 ? cross1 - cross2 : cross2 - cross1;
        priceImpactBps = Number(
          (diff * BigInt(10000)) / (spotPrice.priceNum * effectivePriceDenom),
        );
      }

      return {
        success: true as const,
        data: {
          ...stringifyBigInts(est),
          pricePerToken: `${spotPrice.priceNum.toString()}/${spotPrice.priceDenom.toString()}`,
          priceImpactBps,
        },
      };
    }
  } catch (error) {
    console.error("getQuote error:", error);
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : "Failed to get quote",
    };
  }
}

// ──────────────────────────────────────────────
// executeBuy — authenticated
// ──────────────────────────────────────────────

export async function executeBuy(
  mintAddress: string,
  solAmount: string,
  slippageBps: number,
) {
  const user = await getAuthenticatedUser();

  const parsed = buySchema.safeParse({ mintAddress, solAmount, slippageBps });
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }

  try {
    // Look up creatorToken by mintAddress
    const token = await db.query.creatorToken.findFirst({
      where: eq(creatorToken.mintAddress, mintAddress),
    });
    if (!token) {
      return {
        success: false as const,
        error: "Token not found for mint address",
      };
    }

    const solAmountBig = BigInt(solAmount);
    const result = await buildAndSendBuy(
      user.id,
      mintAddress,
      solAmountBig,
      slippageBps,
    );

    // Calculate price per token for the record
    const pricePerToken =
      result.estimate.tokensOut > BigInt(0)
        ? `${result.estimate.solIntoCurve.toString()}/${result.estimate.tokensOut.toString()}`
        : null;

    // Insert pending trade record
    const tradeId = crypto.randomUUID();
    await db.insert(trade).values({
      id: tradeId,
      userId: user.id,
      creatorTokenId: token.id,
      mintAddress,
      type: "buy",
      solAmount: solAmount,
      tokenAmount: result.estimate.tokensOut.toString(),
      feeAmount: result.estimate.totalFee.toString(),
      pricePerToken,
      txSignature: result.signature,
      status: "pending",
    });

    return {
      success: true as const,
      signature: result.signature,
      tradeId,
      estimate: {
        tokensOut: result.estimate.tokensOut.toString(),
        totalFee: result.estimate.totalFee.toString(),
        platformFee: result.estimate.platformFee.toString(),
        creatorFee: result.estimate.creatorFee.toString(),
        solIntoCurve: result.estimate.solIntoCurve.toString(),
      },
    };
  } catch (error) {
    console.error("executeBuy error:", error);
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Buy transaction failed. Please try again.",
    };
  }
}

// ──────────────────────────────────────────────
// executeSell — authenticated
// ──────────────────────────────────────────────

export async function executeSell(
  mintAddress: string,
  tokenAmount: string,
  slippageBps: number,
) {
  const user = await getAuthenticatedUser();

  const parsed = sellSchema.safeParse({
    mintAddress,
    tokenAmount,
    slippageBps,
  });
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }

  try {
    // Look up creatorToken by mintAddress
    const token = await db.query.creatorToken.findFirst({
      where: eq(creatorToken.mintAddress, mintAddress),
    });
    if (!token) {
      return {
        success: false as const,
        error: "Token not found for mint address",
      };
    }

    const tokenAmountBig = BigInt(tokenAmount);
    const result = await buildAndSendSell(
      user.id,
      mintAddress,
      tokenAmountBig,
      slippageBps,
    );

    // Calculate price per token for the record
    const pricePerToken =
      tokenAmountBig > BigInt(0)
        ? `${result.estimate.grossSol.toString()}/${tokenAmountBig.toString()}`
        : null;

    // Insert pending trade record
    const tradeId = crypto.randomUUID();
    await db.insert(trade).values({
      id: tradeId,
      userId: user.id,
      creatorTokenId: token.id,
      mintAddress,
      type: "sell",
      solAmount: result.estimate.netSol.toString(),
      tokenAmount,
      feeAmount: result.estimate.totalFee.toString(),
      pricePerToken,
      txSignature: result.signature,
      status: "pending",
    });

    return {
      success: true as const,
      signature: result.signature,
      tradeId,
      estimate: {
        netSol: result.estimate.netSol.toString(),
        grossSol: result.estimate.grossSol.toString(),
        totalFee: result.estimate.totalFee.toString(),
        platformFee: result.estimate.platformFee.toString(),
        creatorFee: result.estimate.creatorFee.toString(),
      },
    };
  } catch (error) {
    console.error("executeSell error:", error);
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Sell transaction failed. Please try again.",
    };
  }
}
