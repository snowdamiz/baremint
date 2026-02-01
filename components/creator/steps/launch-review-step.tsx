"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  AlertTriangle,
  Rocket,
  ArrowLeft,
  Coins,
} from "lucide-react";
import { toast } from "sonner";
import type { TokenConfigData } from "./token-config-step";

interface LaunchResult {
  mintAddress: string;
  txSignature: string;
  bondingCurveAddress: string;
  vestingAddress: string;
}

interface LaunchReviewStepProps {
  data: TokenConfigData;
  imageUrl: string;
  onLaunchComplete: (result: LaunchResult) => void;
  onBack: () => void;
}

export function LaunchReviewStep({
  data,
  imageUrl,
  onLaunchComplete,
  onBack,
}: LaunchReviewStepProps) {
  const [launching, setLaunching] = useState(false);

  async function handleLaunch() {
    setLaunching(true);
    try {
      const res = await fetch("/api/creator/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenName: data.tokenName.trim(),
          tickerSymbol: data.tickerSymbol,
          description: data.description.trim(),
          imageUrl,
          burnSolPrice: data.burnSolPrice,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Token launch failed");
      }

      const result = await res.json();
      onLaunchComplete(result);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Token launch failed",
      );
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h2 className="text-lg font-semibold">Review & Launch</h2>
        <p className="text-sm text-muted-foreground">
          Review your token details before launching on the Solana blockchain.
        </p>
      </div>

      {/* Token Summary Card */}
      <div className="rounded-lg border bg-muted/30 p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border">
            {imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={imageUrl}
                alt={data.tokenName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted">
                <Coins className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold">{data.tokenName}</h3>
            <p className="text-sm font-medium text-muted-foreground">
              ${data.tickerSymbol}
            </p>
          </div>
        </div>

        {data.description && (
          <p className="mt-3 text-sm text-muted-foreground">
            {data.description}
          </p>
        )}

        <Separator className="my-4" />

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Supply</span>
            <span className="font-medium">1,000,000,000</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Creator Allocation</span>
            <span className="font-medium">10% (100,000,000 tokens)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Vesting Schedule</span>
            <span className="font-medium">30-day cliff + 60-day linear</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Burn Price</span>
            <span className="font-medium">{data.burnSolPrice} SOL</span>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Platform Fee (Buy)</span>
            <span className="font-medium">2.5%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Platform Fee (Sell)</span>
            <span className="font-medium">2.5%</span>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="text-sm">
          <p className="font-medium text-amber-500">This action is permanent</p>
          <p className="mt-1 text-muted-foreground">
            Launching a token creates an on-chain SPL token with a fixed supply.
            You cannot undo this action, and you cannot launch another token for
            90 days.
          </p>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={launching}
          className="flex-1"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleLaunch}
          disabled={launching}
          className="flex-1"
        >
          {launching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Launching...
            </>
          ) : (
            <>
              <Rocket className="mr-2 h-4 w-4" />
              Launch Token
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
