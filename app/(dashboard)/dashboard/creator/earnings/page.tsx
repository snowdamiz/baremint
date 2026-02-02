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
import { getCreatorEarnings, getTipSummary } from "@/app/trade/[token]/earnings-actions";
import { getDonationHistory } from "@/app/trade/[token]/donate-actions";
import {
  ArrowLeft,
  Coins,
  ArrowRightLeft,
  Heart,
} from "lucide-react";
import Link from "next/link";
import { EarningsDashboard } from "./earnings-dashboard";

function formatSol(lamports: string): string {
  return (Number(lamports) / 1e9).toFixed(4);
}

function formatTokens(raw: string, decimals: number = 6): string {
  const val = Number(raw) / Math.pow(10, decimals);
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
  return val.toFixed(2);
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
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

  const [result, tipSummary, tipHistory] = await Promise.all([
    getCreatorEarnings(token.mintAddress),
    getTipSummary(profile.id),
    getDonationHistory(token.mintAddress),
  ]);

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

      {/* Interactive earnings cards (client component) */}
      <EarningsDashboard
        earnings={result.data}
        mintAddress={token.mintAddress}
        tickerSymbol={token.tickerSymbol}
        tipSummary={tipSummary}
      />

      {/* Recent Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className="h-4 w-4 text-pink-500" />
            Recent Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tipHistory.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              No tips received yet
            </p>
          ) : (
            <div className="space-y-3">
              {tipHistory.map((tip) => (
                <div
                  key={tip.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        tip.type === "sol"
                          ? "bg-purple-500/10"
                          : "bg-blue-500/10"
                      }`}
                    >
                      {tip.type === "sol" ? (
                        <Coins className="h-4 w-4 text-purple-500" />
                      ) : (
                        <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {tip.fromUserName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatRelativeTime(tip.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {tip.type === "sol"
                        ? `${formatSol(tip.amount)} SOL`
                        : `${formatTokens(tip.amount)} ${token.tickerSymbol}`}
                    </div>
                    <a
                      href={`https://explorer.solana.com/tx/${tip.txSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      View tx
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
