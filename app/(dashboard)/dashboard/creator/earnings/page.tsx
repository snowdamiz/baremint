import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { creatorProfile, creatorToken } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCreatorEarnings } from "@/app/trade/[token]/earnings-actions";
import {
  ArrowLeft,
  Coins,
  TrendingUp,
  Lock,
  Flame,
  ArrowRightLeft,
  Heart,
} from "lucide-react";
import Link from "next/link";

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

export default async function CreatorEarningsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth");
  }

  // Look up creator profile and token
  const profile = await db.query.creatorProfile.findFirst({
    where: eq(creatorProfile.userId, session.user.id),
  });

  if (!profile) {
    redirect("/dashboard/creator");
  }

  const token = await db.query.creatorToken.findFirst({
    where: eq(creatorToken.creatorProfileId, profile.id),
  });

  if (!token) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Earnings</h1>
          <p className="text-sm text-muted-foreground">
            You need to launch a token before you can view earnings.
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Launch your creator token to start earning from trade fees, burns, and tips.
            </p>
            <Link
              href="/dashboard/creator"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Go to Creator Dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const result = await getCreatorEarnings(token.mintAddress);

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Earnings</h1>
          <p className="text-sm text-destructive">
            Failed to load earnings: {result.error}
          </p>
        </div>
      </div>
    );
  }

  const earnings = result.data;

  // Calculate vesting progress percentage
  let vestingPercent = 0;
  if (earnings.vesting) {
    const total = Number(earnings.vesting.total);
    const claimed = Number(earnings.vesting.claimed);
    if (total > 0) {
      vestingPercent = Math.round((claimed / total) * 100);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/creator"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-card transition-colors hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Earnings</h1>
          <p className="text-sm text-muted-foreground">
            Revenue from ${token.tickerSymbol} token economy
          </p>
        </div>
      </div>

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
            <button
              disabled
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground opacity-50"
              title="Coming soon"
            >
              Withdraw
            </button>
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
                  {formatTokens(earnings.vesting.claimable)} ${token.tickerSymbol}
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

                <button
                  disabled
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground opacity-50"
                  title="Coming soon"
                >
                  Claim Tokens
                </button>
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
                  Coming soon
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
