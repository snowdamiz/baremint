"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { executeWithdrawal } from "@/app/(dashboard)/dashboard/withdraw/actions";

interface ReviewCardProps {
  toAddress: string;
  amountLamports: string;
  solDisplay: string;
  usdDisplay: string;
}

const ESTIMATED_FEE_LAMPORTS = 5000; // 0.000005 SOL

export function ReviewCard({
  toAddress,
  amountLamports,
  solDisplay,
  usdDisplay,
}: ReviewCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    signature?: string;
  } | null>(null);

  const feeSol = ESTIMATED_FEE_LAMPORTS / 1_000_000_000;

  async function handleConfirm() {
    setError(null);

    if (!totpCode.trim()) {
      setError("Enter your 2FA code to confirm");
      return;
    }

    startTransition(async () => {
      const res = await executeWithdrawal(toAddress, amountLamports, totpCode.trim());

      if (res.error) {
        setError(res.error);
        return;
      }

      setResult({
        success: true,
        signature: res.signature,
      });
    });
  }

  if (result?.success) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Withdrawal Successful</h3>
            <p className="text-sm text-muted-foreground">
              {solDisplay} SOL sent to {toAddress.slice(0, 8)}...{toAddress.slice(-4)}
            </p>
          </div>
          {result.signature && (
            <a
              href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View on Solana Explorer
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/dashboard/withdraw")}
          >
            Make Another Withdrawal
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Withdrawal Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Destination</span>
            <span className="font-mono text-right max-w-[240px] truncate">
              {toAddress}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">{solDisplay} SOL</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">USD Equivalent</span>
            <span>${usdDisplay}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Network Fee (est.)</span>
            <span>~{feeSol} SOL</span>
          </div>

          <Separator />

          <div className="flex justify-between text-sm font-medium">
            <span>Total</span>
            <span>
              {(parseFloat(solDisplay) + feeSol).toFixed(9)} SOL
            </span>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="totp-confirm">2FA Code</Label>
          <Input
            id="totp-confirm"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            autoComplete="one-time-code"
            className="text-center text-lg tracking-widest"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
            }}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button
          className="w-full"
          onClick={handleConfirm}
          disabled={isPending}
        >
          {isPending ? (
            "Sending..."
          ) : (
            <>
              Confirm Withdrawal
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Go Back
        </Button>
      </CardFooter>
    </Card>
  );
}
