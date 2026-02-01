"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  PartyPopper,
  Copy,
  Check,
  ExternalLink,
  LayoutDashboard,
} from "lucide-react";
import { toast } from "sonner";

interface LaunchSuccessStepProps {
  tokenName: string;
  tickerSymbol: string;
  mintAddress: string;
  txSignature: string;
}

export function LaunchSuccessStep({
  tokenName,
  tickerSymbol,
  mintAddress,
  txSignature,
}: LaunchSuccessStepProps) {
  const [mintCopied, setMintCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    // Fire confetti on mount
    import("canvas-confetti").then((confettiModule) => {
      const confetti = confettiModule.default;
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      // Second burst slightly delayed
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });
      }, 250);
    });
  }, []);

  function truncateAddress(addr: string): string {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  async function copyMintAddress() {
    try {
      await navigator.clipboard.writeText(mintAddress);
      setMintCopied(true);
      setTimeout(() => setMintCopied(false), 2000);
    } catch {
      toast.error("Failed to copy address");
    }
  }

  async function copyTokenLink() {
    const url = `${window.location.origin}/token/${mintAddress}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  }

  function shareOnTwitter() {
    const text = `I just launched my creator token $${tickerSymbol} (${tokenName}) on @baremint!`;
    const url = `${window.location.origin}/token/${mintAddress}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col items-center space-y-6 py-4">
      {/* Celebration header */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
        <PartyPopper className="h-10 w-10 text-green-500" />
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold">Your token is live!</h2>
        <p className="mt-2 text-muted-foreground">
          <span className="font-semibold">{tokenName}</span> (${tickerSymbol})
          has been successfully launched on Solana.
        </p>
      </div>

      {/* Token details card */}
      <div className="w-full rounded-lg border bg-muted/30 p-4 sm:p-6">
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Token Name</span>
            <span className="font-medium">{tokenName}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Ticker</span>
            <span className="font-medium">${tickerSymbol}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-muted-foreground">Mint Address</span>
            <button
              onClick={copyMintAddress}
              className="flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-xs hover:bg-muted"
            >
              {truncateAddress(mintAddress)}
              {mintCopied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          </div>

          <Separator />

          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Your 10% creator allocation (100,000,000 tokens) is vesting over
              60 days after a 30-day cliff. You can claim vested tokens
              progressively after the cliff period ends.
            </p>
          </div>
        </div>
      </div>

      {/* Share buttons */}
      <div className="flex w-full gap-3">
        <Button
          variant="outline"
          onClick={shareOnTwitter}
          className="flex-1"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Share on Twitter
        </Button>
        <Button variant="outline" onClick={copyTokenLink} className="flex-1">
          {linkCopied ? (
            <Check className="mr-2 h-4 w-4 text-green-500" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          Copy Link
        </Button>
      </div>

      {/* Transaction explorer link */}
      <a
        href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        View transaction on Solana Explorer
        <ExternalLink className="h-3 w-3" />
      </a>

      {/* Go to Dashboard */}
      <Button asChild className="w-full" size="lg">
        <a href="/dashboard">
          <LayoutDashboard className="mr-2 h-4 w-4" />
          Go to Dashboard
        </a>
      </Button>
    </div>
  );
}
