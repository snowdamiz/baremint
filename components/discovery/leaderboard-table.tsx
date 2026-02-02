"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getLeaderboard,
  type LeaderboardItem,
} from "@/lib/discovery/leaderboard-actions";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function formatVolume(lamportsStr: string): string {
  const lamports = Number(lamportsStr);
  if (lamports === 0) return "0.00 SOL";
  return (lamports / 1e9).toFixed(2) + " SOL";
}

// ──────────────────────────────────────────────
// LeaderboardTable
// ──────────────────────────────────────────────

type SortOption = "volume_24h" | "newest";

export function LeaderboardTable({
  initialTokens,
  initialHasMore,
}: {
  initialTokens: LeaderboardItem[];
  initialHasMore: boolean;
}) {
  const [tokens, setTokens] = useState(initialTokens);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [sortBy, setSortBy] = useState<SortOption>("volume_24h");
  const [offset, setOffset] = useState(0);
  const [isPending, startTransition] = useTransition();

  function handleSort(newSort: SortOption) {
    if (newSort === sortBy) return;
    setSortBy(newSort);
    setOffset(0);
    startTransition(async () => {
      const result = await getLeaderboard(newSort, 50, 0);
      setTokens(result.tokens);
      setHasMore(result.hasMore);
    });
  }

  function handleLoadMore() {
    const newOffset = offset + 50;
    startTransition(async () => {
      const result = await getLeaderboard(sortBy, 50, newOffset);
      setTokens((prev) => [...prev, ...result.tokens]);
      setHasMore(result.hasMore);
      setOffset(newOffset);
    });
  }

  return (
    <div className="space-y-4">
      {/* Sort toggles */}
      <div className="flex gap-2">
        <button
          onClick={() => handleSort("volume_24h")}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
            sortBy === "volume_24h"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          Top Volume
        </button>
        <button
          onClick={() => handleSort("newest")}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
            sortBy === "newest"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          Newest
        </button>
        {isPending && (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground self-center ml-2" />
        )}
      </div>

      {/* Table */}
      {tokens.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          No tokens launched yet
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="grid grid-cols-[2rem_1fr_1fr_auto_auto] md:grid-cols-[2rem_1fr_1fr_auto_auto] gap-x-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
            <span>#</span>
            <span>Token</span>
            <span>Creator</span>
            <span className="text-right">24h Volume</span>
            <span className="text-right hidden md:block">Trades</span>
          </div>

          {/* Rows */}
          <div className="divide-y">
            {tokens.map((token, index) => (
              <Link
                key={token.tokenId}
                href={`/trade/${token.mintAddress}`}
                className="grid grid-cols-[2rem_1fr_1fr_auto_auto] md:grid-cols-[2rem_1fr_1fr_auto_auto] gap-x-3 px-3 py-3 items-center hover:bg-accent/50 transition-colors"
              >
                {/* Rank */}
                <span className="text-sm font-medium text-muted-foreground">
                  {offset + index + 1}
                </span>

                {/* Token */}
                <div className="flex items-center gap-2 min-w-0">
                  {token.imageUrl ? (
                    <Image
                      src={token.imageUrl}
                      alt={token.tokenName}
                      width={32}
                      height={32}
                      className="rounded-full shrink-0"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted shrink-0 flex items-center justify-center text-xs font-bold">
                      {token.tickerSymbol.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {token.tokenName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${token.tickerSymbol}
                    </p>
                  </div>
                </div>

                {/* Creator */}
                <div className="flex items-center gap-2 min-w-0">
                  {token.creatorAvatarUrl ? (
                    <Image
                      src={token.creatorAvatarUrl}
                      alt={token.creatorName}
                      width={24}
                      height={24}
                      className="rounded-full shrink-0"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-muted shrink-0" />
                  )}
                  <span className="text-sm truncate">{token.creatorName}</span>
                </div>

                {/* Volume */}
                <span className="text-sm font-medium text-right whitespace-nowrap">
                  {formatVolume(token.volume24h)}
                </span>

                {/* Trades (hidden on mobile) */}
                <span className="text-sm text-muted-foreground text-right hidden md:block">
                  {token.tradeCount}
                </span>
              </Link>
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={handleLoadMore}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {isPending ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
