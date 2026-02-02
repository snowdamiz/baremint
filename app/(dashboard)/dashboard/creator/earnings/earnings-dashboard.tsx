"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Coins,
  TrendingUp,
  Lock,
  Flame,
  ArrowRightLeft,
  Heart,
  Loader2,
} from "lucide-react";
import {
  withdrawCreatorFees,
  claimVestedTokens,
} from "@/app/trade/[token]/earnings-actions";
import type { CreatorEarningsData, TipSummary } from "@/app/trade/[token]/earnings-actions";

function formatSol(lamports: string): string {
  return (Number(lamports) / 1e9).toFixed(4);
}

function formatTokens(raw: string, decimals: number = 6): string {
  const val = Number(raw) / Math.pow(10, decimals);
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
  return val.toFixed(2);
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function explorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

interface EarningsDashboardProps {
  earnings: CreatorEarningsData;
  mintAddress: string;
  tickerSymbol: string;
  tipSummary?: TipSummary;
}

export function EarningsDashboard({
  earnings,
  mintAddress,
  tickerSymbol,
  tipSummary,
}: EarningsDashboardProps) {
  const router = useRouter();
  const [isWithdrawing, startWithdraw] = useTransition();
  const [isClaiming, startClaim] = useTransition();

  // Calculate vesting progress percentage
  let vestingPercent = 0;
  if (earnings.vesting) {
    const total = Number(earnings.vesting.total);
    const claimed = Number(earnings.vesting.claimed);
    if (total > 0) {
      vestingPercent = Math.round((claimed / total) * 100);
    }
  }

  const canWithdraw = earnings.currentAccruedFees !== "0";
  const canClaim =
    earnings.vesting !== null &&
    earnings.vesting.claimable !== "0" &&
    !earnings.vesting.isRevoked;

  function handleWithdraw() {
    startWithdraw(async () => {
      const result = await withdrawCreatorFees(mintAddress);

      if (result.success) {
        toast.success("Fees withdrawn successfully", {
          description: `${formatSol(result.amount)} SOL sent to your wallet`,
          action: {
            label: "View tx",
            onClick: () => window.open(explorerUrl(result.signature), "_blank"),
          },
        });
        router.refresh();
      } else {
        toast.error("Withdrawal failed", {
          description: result.error,
        });
      }
    });
  }

  function handleClaim() {
    startClaim(async () => {
      const result = await claimVestedTokens(mintAddress);

      if (result.success) {
        toast.success("Tokens claimed successfully", {
          description: `${formatTokens(result.amount)} $${tickerSymbol} sent to your wallet`,
          action: {
            label: "View tx",
            onClick: () => window.open(explorerUrl(result.signature), "_blank"),
          },
        });
        router.refresh();
      } else {
        toast.error("Claim failed", {
          description: result.error,
        });
      }
    });
  }

  return (
    <>
      {/* Revenue Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Trade Fee Revenue */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Trade Fee Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatSol(earnings.tradeFeeRevenue)} SOL
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Your 50% share of all confirmed trade fees
            </p>
          </CardContent>
        </Card>

        {/* Current Accrued Fees (on-chain) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Coins className="h-4 w-4" />
              Accrued Fees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatSol(earnings.currentAccruedFees)} SOL
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Available to withdraw from bonding curve
            </p>
            <Button
              size="sm"
              className="mt-3"
              disabled={!canWithdraw || isWithdrawing}
              onClick={handleWithdraw}
            >
              {isWithdrawing ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Withdrawing...
                </>
              ) : (
                "Withdraw SOL"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Vesting Status */}
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Lock className="h-4 w-4" />
              Vesting Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {earnings.vesting ? (
              <div className="space-y-3">
                <div className="text-2xl font-bold">
                  {formatTokens(earnings.vesting.claimable)} ${tickerSymbol}
                </div>
                <p className="text-xs text-muted-foreground">
                  Claimable now
                </p>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Claimed: {formatTokens(earnings.vesting.claimed)}</span>
                    <span>Total: {formatTokens(earnings.vesting.total)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${vestingPercent}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {vestingPercent}% claimed
                  </div>
                </div>

                {earnings.vesting.isRevoked ? (
                  <p className="text-xs font-medium text-destructive">
                    Vesting revoked
                  </p>
                ) : earnings.vesting.nextClaimDate ? (
                  <p className="text-xs text-muted-foreground">
                    Next claim window: {formatDate(earnings.vesting.nextClaimDate)}
                  </p>
                ) : null}

                <Button
                  size="sm"
                  disabled={!canClaim || isClaiming}
                  onClick={handleClaim}
                >
                  {isClaiming ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    "Claim Tokens"
                  )}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No vesting account found on-chain.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10">
                <ArrowRightLeft className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <div className="text-sm font-medium">Trade Fees</div>
                <div className="text-xs text-muted-foreground">
                  {formatSol(earnings.tradeFeeRevenue)} SOL earned
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/10">
                <Flame className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <div className="text-sm font-medium">Burns</div>
                <div className="text-xs text-muted-foreground">
                  {earnings.burnCount} content unlock{earnings.burnCount !== 1 ? "s" : ""}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-500/10">
                <Heart className="h-4 w-4 text-pink-500" />
              </div>
              <div>
                <div className="text-sm font-medium">Tips</div>
                <div className="text-xs text-muted-foreground">
                  {tipSummary && tipSummary.count > 0
                    ? `${tipSummary.count} tip${tipSummary.count !== 1 ? "s" : ""} -- ${formatSol(tipSummary.solTotal)} SOL, ${formatTokens(tipSummary.tokenTotal)} ${tickerSymbol}`
                    : "No tips yet"}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
