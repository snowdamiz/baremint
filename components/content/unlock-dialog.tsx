"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock, Flame, Loader2, CheckCircle2 } from "lucide-react";

interface BurnQuote {
  tokensRequired: string;
  burnSolPrice: string;
  totalFee: string;
  platformFee: string;
  creatorFee: string;
  tokenTicker: string;
  mintAddress: string;
}

interface UnlockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  accessLevel: "hold_gated" | "burn_gated";
  requiredBalance: string;
  viewerBalance: string;
  tokenTicker: string;
  creatorTokenId: string;
  postId: string;
  onUnlocked?: () => void;
}

type DialogStep = "quote" | "confirming" | "success" | "error";

/** Format raw token amount (string of lamport-like units) for display: divide by 10^6, show up to 2 decimals */
function formatTokenAmount(raw: string): string {
  try {
    const value = BigInt(raw);
    const whole = value / BigInt(1_000_000);
    const frac = value % BigInt(1_000_000);
    if (frac === BigInt(0)) return whole.toString();
    // Pad fraction to 6 digits, then trim to 2
    const fracStr = frac.toString().padStart(6, "0").slice(0, 2);
    // Remove trailing zeros
    const trimmed = fracStr.replace(/0+$/, "");
    return trimmed ? `${whole}.${trimmed}` : whole.toString();
  } catch {
    return raw;
  }
}

/** Format lamports to SOL: divide by 10^9, show up to 4 decimals */
function formatSolAmount(lamports: string): string {
  try {
    const value = BigInt(lamports);
    const whole = value / BigInt(1_000_000_000);
    const frac = value % BigInt(1_000_000_000);
    if (frac === BigInt(0)) return whole.toString();
    const fracStr = frac.toString().padStart(9, "0").slice(0, 4);
    const trimmed = fracStr.replace(/0+$/, "");
    return trimmed ? `${whole}.${trimmed}` : whole.toString();
  } catch {
    return lamports;
  }
}

export function UnlockDialog({
  isOpen,
  onClose,
  accessLevel,
  requiredBalance,
  viewerBalance,
  tokenTicker,
  creatorTokenId,
  postId,
  onUnlocked,
}: UnlockDialogProps) {
  const [step, setStep] = useState<DialogStep>("quote");
  const [quote, setQuote] = useState<BurnQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Fetch burn quote when dialog opens for burn_gated posts
  useEffect(() => {
    if (!isOpen || accessLevel !== "burn_gated") return;

    setStep("quote");
    setQuote(null);
    setQuoteError(null);
    setQuoteLoading(true);

    let cancelled = false;

    async function fetchQuote() {
      try {
        const res = await fetch(`/api/burn/${postId}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to get burn quote");
        }
        const data = await res.json();
        if (!cancelled) {
          setQuote(data);
          setQuoteLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setQuoteError(
            err instanceof Error ? err.message : "Failed to get burn quote",
          );
          setQuoteLoading(false);
        }
      }
    }

    fetchQuote();
    return () => {
      cancelled = true;
    };
  }, [isOpen, accessLevel, postId]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setStep("quote");
      setQuote(null);
      setQuoteError(null);
      setQuoteLoading(false);
    }
  }, [isOpen]);

  const executeBurn = useCallback(async () => {
    setStep("confirming");

    try {
      const res = await fetch(`/api/burn/${postId}`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Burn transaction failed");
      }

      setStep("success");

      // Trigger content refresh and auto-close
      onUnlocked?.();
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Burn transaction failed",
      );
      setStep("quote");
    }
  }, [postId, onUnlocked, onClose]);

  // Check if viewer has enough tokens for burn
  const hasEnoughForBurn =
    quote &&
    BigInt(viewerBalance || "0") >= BigInt(quote.tokensRequired);

  // Hold-gated: balance progress
  const required = Number(requiredBalance) || 0;
  const viewer = Number(viewerBalance) || 0;
  const progress = required > 0 ? Math.min((viewer / required) * 100, 100) : 0;
  const hasEnough = viewer >= required && required > 0;

  // Trade page link: for hold_gated use creatorTokenId, for burn_gated use mintAddress from quote
  const tradeLink =
    accessLevel === "burn_gated" && quote?.mintAddress
      ? `/trade/${quote.mintAddress}`
      : `/trade/${creatorTokenId}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {accessLevel === "burn_gated" ? (
              <Flame className="h-5 w-5 text-orange-500" />
            ) : (
              <Lock className="h-5 w-5 text-primary" />
            )}
            {step === "success" ? "Content Unlocked!" : "Unlock This Content"}
          </DialogTitle>
          {step !== "success" && (
            <DialogDescription>
              {accessLevel === "hold_gated"
                ? `Hold ${requiredBalance} $${tokenTicker} tokens to access this creator's gated content`
                : "Burn tokens for permanent access to this post"}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Hold-gated flow */}
        {accessLevel === "hold_gated" && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Your balance</span>
                <span className="font-medium">
                  {viewerBalance} / {requiredBalance} ${tokenTicker}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    hasEnough ? "bg-green-500" : "bg-primary"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {hasEnough && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
                You have enough tokens! Access will be granted automatically.
              </div>
            )}

            <Button
              onClick={() => {
                window.location.href = tradeLink;
              }}
              className="w-full"
            >
              Buy ${tokenTicker} Tokens
            </Button>
          </div>
        )}

        {/* Burn-gated flow */}
        {accessLevel === "burn_gated" && step === "quote" && (
          <div className="space-y-4">
            {quoteLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {quoteError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-center text-sm text-destructive">
                {quoteError}
              </div>
            )}

            {quote && !quoteLoading && (
              <>
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Burn cost</span>
                    <span className="font-semibold">
                      {formatTokenAmount(quote.tokensRequired)} ${tokenTicker}
                    </span>
                  </div>
                  <div className="border-t pt-2 space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Platform fee</span>
                      <span>{formatSolAmount(quote.platformFee)} SOL</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Creator fee</span>
                      <span>{formatSolAmount(quote.creatorFee)} SOL</span>
                    </div>
                  </div>
                  <div className="border-t pt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Your balance</span>
                    <span className="font-medium">
                      {formatTokenAmount(viewerBalance || "0")} ${tokenTicker}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300">
                  Tokens will be permanently destroyed. This action cannot be
                  undone.
                </div>

                <Button
                  onClick={executeBurn}
                  disabled={!hasEnoughForBurn}
                  className="w-full"
                >
                  <Flame className="h-4 w-4" />
                  Burn to Unlock
                </Button>

                {!hasEnoughForBurn && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.location.href = tradeLink;
                    }}
                    className="w-full"
                  >
                    Buy ${tokenTicker} Tokens
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {/* Confirming state */}
        {accessLevel === "burn_gated" && step === "confirming" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            <p className="text-sm font-medium">Burning tokens...</p>
            <p className="text-xs text-muted-foreground">
              Please wait while the transaction processes
            </p>
          </div>
        )}

        {/* Success state */}
        {accessLevel === "burn_gated" && step === "success" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              Content Unlocked!
            </p>
            <p className="text-xs text-muted-foreground">
              You now have permanent access to this post
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
