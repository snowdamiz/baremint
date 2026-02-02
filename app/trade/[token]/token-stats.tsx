"use client";

import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";

interface TokenStatsProps {
  tokenName: string;
  tickerSymbol: string;
  creatorDisplayName: string;
  creatorAvatarUrl: string | null;
  creatorProfileId: string;
  /** virtualSolReserves as string (lamports) */
  virtualSolReserves: string;
  /** virtualTokenReserves as string (raw tokens) */
  virtualTokenReserves: string;
  /** realTokenReserves as string (raw tokens) */
  realTokenReserves: string;
  /** tokenTotalSupply as string (raw tokens) */
  tokenTotalSupply: string;
}

/** Format large numbers with K/M/B suffixes */
function formatCompact(value: bigint, decimals: number = 9): string {
  // Convert from raw (9 decimal) to whole units
  const whole = value / BigInt(10 ** decimals);
  const num = Number(whole);

  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

/** Format SOL price from rational (lamports / raw tokens) */
function formatSolPrice(solReserves: string, tokenReserves: string): string {
  const sol = BigInt(solReserves);
  const token = BigInt(tokenReserves);
  if (token === BigInt(0)) return "0";

  // Price = solReserves / tokenReserves
  // Both are in their raw forms: sol in lamports (9 dec), tokens in raw (9 dec)
  // So lamports / raw_tokens gives price in SOL per token (decimals cancel out)
  // We want to show in SOL, so divide lamports by 1e9
  // price_sol = (solReserves / tokenReserves) / 1e9
  // To preserve precision: (solReserves * 1e9) / (tokenReserves * 1e9) = solReserves / tokenReserves
  // Actually: price in SOL = solReserves / (tokenReserves * 1e9) -- no.
  // Price per token in lamports = solReserves / tokenReserves (both in raw units, so decimals cancel)
  // Price per token in SOL = (solReserves / tokenReserves) / 1e9
  // Better: multiply numerator by precision factor
  const PRECISION = BigInt(10 ** 12);
  const priceScaled = (sol * PRECISION) / token;
  const priceInSol = Number(priceScaled) / (Number(PRECISION) / 1e-9);

  // Actually let's simplify: both reserves are in lamports and raw-token-units respectively.
  // Price in lamports per raw token = virtualSolReserves / virtualTokenReserves
  // Since 1 SOL = 1e9 lamports, and tokens also have 9 decimals (1 token = 1e9 raw):
  // Price in SOL per token = (virtualSolReserves / 1e9) / (virtualTokenReserves / 1e9) = virtualSolReserves / virtualTokenReserves
  // This gives SOL per token directly (the 1e9 factors cancel).
  // Wait, that gives lamports per raw token. To get SOL per token:
  // SOL per token = (virtualSolReserves / virtualTokenReserves) -- this is lamports per raw unit
  // To convert to SOL per whole-token: multiply by (1e9 / 1e9) = 1. No change.
  // Hmm, let me think again. virtualSolReserves is in lamports. virtualTokenReserves is in raw token units.
  // price_lamports_per_raw = virtualSolReserves / virtualTokenReserves
  // 1 whole token = 10^9 raw units, 1 SOL = 10^9 lamports
  // price_SOL_per_token = price_lamports_per_raw * (10^9 raw/token) / (10^9 lamports/SOL) = price_lamports_per_raw
  // So the ratio IS the price in SOL per token. Let's compute as float.
  const priceFloat = Number(sol) / Number(token);

  if (priceFloat < 0.000001) {
    return priceFloat.toExponential(2);
  }
  if (priceFloat < 0.01) {
    return priceFloat.toFixed(6);
  }
  if (priceFloat < 1) {
    return priceFloat.toFixed(4);
  }
  return priceFloat.toFixed(2);
}

/** Format SOL market cap */
function formatMarketCap(
  solReserves: string,
  tokenReserves: string,
  circulatingSupply: bigint,
): string {
  const sol = BigInt(solReserves);
  const token = BigInt(tokenReserves);
  if (token === BigInt(0)) return "0 SOL";

  // Market cap in lamports = price_per_raw_token * circulating_raw_supply
  // = (solReserves / tokenReserves) * circulatingSupply
  // = (solReserves * circulatingSupply) / tokenReserves
  const mcLamports = (sol * circulatingSupply) / token;
  const mcSol = Number(mcLamports) / 1e9;

  if (mcSol >= 1_000_000) {
    return `${(mcSol / 1_000_000).toFixed(2)}M SOL`;
  }
  if (mcSol >= 1_000) {
    return `${(mcSol / 1_000).toFixed(2)}K SOL`;
  }
  if (mcSol >= 1) {
    return `${mcSol.toFixed(2)} SOL`;
  }
  return `${mcSol.toFixed(4)} SOL`;
}

export function TokenStats({
  tokenName,
  tickerSymbol,
  creatorDisplayName,
  creatorAvatarUrl,
  creatorProfileId,
  virtualSolReserves,
  virtualTokenReserves,
  realTokenReserves,
  tokenTotalSupply,
}: TokenStatsProps) {
  const circulatingSupply =
    BigInt(tokenTotalSupply) - BigInt(realTokenReserves);

  return (
    <Card className="gap-4 py-4">
      <CardContent className="space-y-4">
        {/* Token identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-sm font-bold text-primary-foreground">
            {tickerSymbol.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold">{tokenName}</h2>
            <p className="text-sm text-muted-foreground">${tickerSymbol}</p>
          </div>
        </div>

        {/* Creator link */}
        <Link
          href={`/creator/${creatorProfileId}`}
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {creatorAvatarUrl ? (
            <Image
              src={creatorAvatarUrl}
              alt={creatorDisplayName}
              width={20}
              height={20}
              className="rounded-full"
            />
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {creatorDisplayName.charAt(0)}
            </div>
          )}
          <span>by {creatorDisplayName}</span>
        </Link>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="font-semibold">
              {formatSolPrice(virtualSolReserves, virtualTokenReserves)} SOL
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Market Cap</p>
            <p className="font-semibold">
              {formatMarketCap(
                virtualSolReserves,
                virtualTokenReserves,
                circulatingSupply,
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Circulating</p>
            <p className="font-semibold">{formatCompact(circulatingSupply)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">24h Volume</p>
            <p className="font-semibold text-muted-foreground">&mdash;</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Holders</p>
            <p className="font-semibold text-muted-foreground">&mdash;</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">24h Change</p>
            <p className="font-semibold text-muted-foreground">&mdash;</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
