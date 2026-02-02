"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import { getTradeHistory, type TradeRecord } from "./actions";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface TradeHistoryProps {
  mintAddress: string;
  tickerSymbol: string;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const LAMPORTS_PER_SOL = 1_000_000_000;
const TOKEN_DECIMALS = 9;

function formatSolAmount(lamports: string): string {
  const val = BigInt(lamports);
  const whole = val / BigInt(LAMPORTS_PER_SOL);
  const frac = val % BigInt(LAMPORTS_PER_SOL);
  const fracStr = frac.toString().padStart(9, "0");
  // Show up to 4 significant decimal digits
  const trimmed = fracStr.replace(/0+$/, "");
  const display = trimmed.length < 2 ? fracStr.slice(0, 4) : trimmed.slice(0, Math.max(trimmed.length, 4));
  return `${whole}.${display}`;
}

function formatTokenAmount(raw: string): string {
  const val = BigInt(raw);
  const whole = val / BigInt(10 ** TOKEN_DECIMALS);
  const frac = val % BigInt(10 ** TOKEN_DECIMALS);
  if (frac === BigInt(0)) {
    return new Intl.NumberFormat().format(Number(whole));
  }
  const fracStr = frac.toString().padStart(TOKEN_DECIMALS, "0");
  const trimmed = fracStr.replace(/0+$/, "");
  const display = trimmed.slice(0, 2);
  return `${new Intl.NumberFormat().format(Number(whole))}.${display}`;
}

function formatPricePerToken(priceRational: string | null): string {
  if (!priceRational || !priceRational.includes("/")) return "--";
  const [num, denom] = priceRational.split("/");
  const numBig = Number(num);
  const denomBig = Number(denom);
  if (denomBig === 0) return "--";
  const price = numBig / denomBig / LAMPORTS_PER_SOL * (10 ** TOKEN_DECIMALS);
  if (price < 0.000001) return price.toExponential(2);
  return price.toFixed(6);
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  // Older than 7 days: show short date
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function TradeHistory({ mintAddress, tickerSymbol }: TradeHistoryProps) {
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTradeHistory(mintAddress, 50, 0);
      setTrades(result.trades);
      setHasMore(result.hasMore);
    } catch {
      // Silently fail — empty state is fine
    } finally {
      setLoading(false);
    }
  }, [mintAddress]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const result = await getTradeHistory(mintAddress, 50, trades.length);
      setTrades((prev) => [...prev, ...result.trades]);
      setHasMore(result.hasMore);
    } catch {
      // Silently fail
    } finally {
      setLoadingMore(false);
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="rounded-xl border bg-card shadow-card">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-medium">Trade History</h3>
        </div>
        <div className="divide-y">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-5 w-10 animate-pulse rounded bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
              <div className="text-right space-y-1.5">
                <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
                <div className="h-3 w-12 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (trades.length === 0) {
    return (
      <div className="rounded-xl border bg-card shadow-card">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-medium">Trade History</h3>
        </div>
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-muted-foreground">No trades yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-card">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-medium">Trade History</h3>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Type</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              <th className="px-4 py-2 text-right font-medium">SOL</th>
              <th className="px-4 py-2 text-right font-medium">Price</th>
              <th className="px-4 py-2 text-right font-medium">Time</th>
              <th className="px-4 py-2 text-right font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium sr-only">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {trades.map((t) => (
              <tr key={t.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <TypeBadge type={t.type} />
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                  {formatTokenAmount(t.tokenAmount)} ${tickerSymbol}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {formatSolAmount(t.solAmount)} SOL
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {formatPricePerToken(t.pricePerToken)} SOL
                </td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">
                  {formatRelativeTime(t.createdAt)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <ExplorerLink txSignature={t.txSignature} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="divide-y md:hidden">
        {trades.map((t) => (
          <div key={t.id} className="flex items-start gap-3 px-4 py-3">
            <TypeBadge type={t.type} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium tabular-nums">
                  {formatTokenAmount(t.tokenAmount)} ${tickerSymbol}
                </span>
                <StatusBadge status={t.status} />
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">{formatSolAmount(t.solAmount)} SOL</span>
                <span>at {formatPricePerToken(t.pricePerToken)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{formatRelativeTime(t.createdAt)}</span>
              <ExplorerLink txSignature={t.txSignature} />
            </div>
          </div>
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="border-t px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={loadingMore}
            onClick={handleLoadMore}
          >
            {loadingMore ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const isBuy = type === "buy";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isBuy
          ? "bg-green-500/10 text-green-500"
          : "bg-red-500/10 text-red-500"
      }`}
    >
      {isBuy ? "BUY" : "SELL"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "confirmed") return null;
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Pending
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
        Failed
      </span>
    );
  }
  return null;
}

function ExplorerLink({ txSignature }: { txSignature: string }) {
  return (
    <a
      href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex text-muted-foreground hover:text-foreground transition-colors"
      title="View on Solana Explorer"
    >
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}
