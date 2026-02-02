"use server";

import crypto from "node:crypto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { creatorToken, trade } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
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
// getChartData — public, no auth required
// ──────────────────────────────────────────────

const VALID_INTERVALS = ["5M", "15M", "1H", "4H", "1D", "1W"] as const;
type ChartInterval = (typeof VALID_INTERVALS)[number];

const INTERVAL_SQL_MAP: Record<ChartInterval, string> = {
  "5M": "5 minutes",
  "15M": "15 minutes",
  "1H": "1 hour",
  "4H": "4 hours",
  "1D": "1 day",
  "1W": "1 week",
};

export interface ChartDataPoint {
  time: number; // unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface LineDataPoint {
  time: number;
  value: number;
}

export type ChartData =
  | { type: "candlestick"; data: ChartDataPoint[] }
  | { type: "line"; data: LineDataPoint[] }
  | { type: "empty" };

export async function getChartData(
  mintAddress: string,
  interval: string,
): Promise<ChartData> {
  if (!VALID_INTERVALS.includes(interval as ChartInterval)) {
    return { type: "empty" };
  }

  const truncInterval = INTERVAL_SQL_MAP[interval as ChartInterval];

  try {
    // Raw SQL for OHLCV aggregation -- drizzle ORM lacks built-in support
    const rows = await db.execute(
      sql`SELECT
        extract(epoch from date_trunc('hour', ${trade.createdAt}))::bigint
          + floor(extract(epoch from ${trade.createdAt} - date_trunc('hour', ${trade.createdAt}))
            / extract(epoch from ${sql.raw(`interval '${truncInterval}'`)}))
          * extract(epoch from ${sql.raw(`interval '${truncInterval}'`)}) as time_bucket,
        MIN(CAST(${trade.solAmount} AS numeric) / NULLIF(CAST(${trade.tokenAmount} AS numeric), 0)) as low,
        MAX(CAST(${trade.solAmount} AS numeric) / NULLIF(CAST(${trade.tokenAmount} AS numeric), 0)) as high,
        (array_agg(CAST(${trade.solAmount} AS numeric) / NULLIF(CAST(${trade.tokenAmount} AS numeric), 0) ORDER BY ${trade.createdAt} ASC))[1] as open,
        (array_agg(CAST(${trade.solAmount} AS numeric) / NULLIF(CAST(${trade.tokenAmount} AS numeric), 0) ORDER BY ${trade.createdAt} DESC))[1] as close,
        SUM(CAST(${trade.solAmount} AS numeric)) as volume
      FROM ${trade}
      WHERE ${trade.mintAddress} = ${mintAddress}
        AND ${trade.status} = 'confirmed'
      GROUP BY time_bucket
      ORDER BY time_bucket ASC`,
    );

    if (!rows || rows.rows.length === 0) {
      return { type: "empty" };
    }

    // Count unique time buckets
    const uniqueBuckets = new Set(
      rows.rows.map((r: Record<string, unknown>) => r.time_bucket),
    );

    if (uniqueBuckets.size < 5) {
      // Sparse data: return line chart
      const lineData: LineDataPoint[] = rows.rows
        .filter(
          (r: Record<string, unknown>) =>
            r.time_bucket != null && r.close != null,
        )
        .map((r: Record<string, unknown>) => ({
          time: Number(r.time_bucket),
          value: Number(r.close),
        }));
      return { type: "line", data: lineData };
    }

    // Sufficient data: return candlestick
    const candleData: ChartDataPoint[] = rows.rows
      .filter(
        (r: Record<string, unknown>) =>
          r.time_bucket != null &&
          r.open != null &&
          r.high != null &&
          r.low != null &&
          r.close != null,
      )
      .map((r: Record<string, unknown>) => ({
        time: Number(r.time_bucket),
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: r.volume ? Number(r.volume) : undefined,
      }));
    return { type: "candlestick", data: candleData };
  } catch (error) {
    console.error("getChartData error:", error);
    return { type: "empty" };
  }
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

// ──────────────────────────────────────────────
// getTradeHistory — authenticated, returns user's trades for a token
// ──────────────────────────────────────────────

export interface TradeRecord {
  id: string;
  type: string;
  solAmount: string;
  tokenAmount: string;
  feeAmount: string;
  pricePerToken: string | null;
  txSignature: string;
  status: string;
  createdAt: string;
  confirmedAt: string | null;
}

export async function getTradeHistory(
  mintAddress: string,
  limit: number = 50,
  offset: number = 0,
): Promise<{ trades: TradeRecord[]; hasMore: boolean }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { trades: [], hasMore: false };
  }

  // Fetch limit + 1 to determine if there are more
  const rows = await db
    .select()
    .from(trade)
    .where(
      and(
        eq(trade.userId, session.user.id),
        eq(trade.mintAddress, mintAddress),
      ),
    )
    .orderBy(desc(trade.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const trades = rows.slice(0, limit).map((row) => ({
    id: row.id,
    type: row.type,
    solAmount: row.solAmount,
    tokenAmount: row.tokenAmount,
    feeAmount: row.feeAmount,
    pricePerToken: row.pricePerToken,
    txSignature: row.txSignature,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
  }));

  return { trades, hasMore };
}

// ──────────────────────────────────────────────
// getHoldings — authenticated, returns user's P&L for a token
// ──────────────────────────────────────────────

export interface HoldingsData {
  netTokens: string;
  currentValueSol: string;
  avgBuyPrice: string;
  unrealizedPnl: string;
  pnlPercent: string;
}

export async function getHoldings(
  mintAddress: string,
): Promise<HoldingsData | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return null;
  }

  // Aggregate confirmed buy trades
  const [buyAgg] = await db
    .select({
      totalSolSpent: sql<string>`COALESCE(SUM(CAST(${trade.solAmount} AS NUMERIC)), 0)`,
      totalTokensBought: sql<string>`COALESCE(SUM(CAST(${trade.tokenAmount} AS NUMERIC)), 0)`,
    })
    .from(trade)
    .where(
      and(
        eq(trade.userId, session.user.id),
        eq(trade.mintAddress, mintAddress),
        eq(trade.type, "buy"),
        eq(trade.status, "confirmed"),
      ),
    );

  // Aggregate confirmed sell trades
  const [sellAgg] = await db
    .select({
      totalSolReceived: sql<string>`COALESCE(SUM(CAST(${trade.solAmount} AS NUMERIC)), 0)`,
      totalTokensSold: sql<string>`COALESCE(SUM(CAST(${trade.tokenAmount} AS NUMERIC)), 0)`,
    })
    .from(trade)
    .where(
      and(
        eq(trade.userId, session.user.id),
        eq(trade.mintAddress, mintAddress),
        eq(trade.type, "sell"),
        eq(trade.status, "confirmed"),
      ),
    );

  const totalTokensBought = BigInt(
    Math.floor(Number(buyAgg.totalTokensBought)),
  );
  const totalTokensSold = BigInt(
    Math.floor(Number(sellAgg.totalTokensSold)),
  );
  const totalSolSpent = BigInt(Math.floor(Number(buyAgg.totalSolSpent)));

  if (totalTokensBought === BigInt(0)) {
    return null;
  }

  const netTokens = totalTokensBought - totalTokensSold;
  if (netTokens <= BigInt(0)) {
    return null;
  }

  // Average buy price = totalSolSpent / totalTokensBought (in lamports per raw token)
  // We keep this as a rational calculation
  const avgBuyPriceNum = totalSolSpent;
  const avgBuyPriceDenom = totalTokensBought;

  // Read current spot price from bonding curve
  try {
    const bondingCurve = await readBondingCurveAccount(mintAddress);
    const spotPrice = calculatePricePerToken(
      bondingCurve.virtualSolReserves,
      bondingCurve.virtualTokenReserves,
    );

    // Current value in lamports = netTokens * spotPrice.priceNum / spotPrice.priceDenom
    const currentValueSol =
      (netTokens * spotPrice.priceNum) / spotPrice.priceDenom;

    // Cost basis for net tokens = netTokens * avgBuyPriceNum / avgBuyPriceDenom
    const costBasis = (netTokens * avgBuyPriceNum) / avgBuyPriceDenom;

    // Unrealized P&L = currentValue - costBasis
    const unrealizedPnl = currentValueSol - costBasis;

    // P&L percent = ((currentValue / costBasis) - 1) * 100
    // = (currentValue - costBasis) * 10000 / costBasis (in hundredths of %)
    let pnlPercent = "0";
    if (costBasis > BigInt(0)) {
      // Multiply by 10000 for 2 decimal places of percent
      const pnlBps = (unrealizedPnl * BigInt(10000)) / costBasis;
      pnlPercent = (Number(pnlBps) / 100).toFixed(2);
    }

    // Average buy price as SOL per token for display
    // avgBuyPriceNum is in lamports, avgBuyPriceDenom is in raw tokens
    // Display as lamports/raw = SOL price ratio
    const avgBuyPriceDisplay =
      avgBuyPriceDenom > BigInt(0)
        ? `${avgBuyPriceNum.toString()}/${avgBuyPriceDenom.toString()}`
        : "0";

    return {
      netTokens: netTokens.toString(),
      currentValueSol: currentValueSol.toString(),
      avgBuyPrice: avgBuyPriceDisplay,
      unrealizedPnl: unrealizedPnl.toString(),
      pnlPercent,
    };
  } catch (error) {
    console.error("getHoldings: failed to read bonding curve", error);
    return null;
  }
}
