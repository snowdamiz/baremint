"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { donateSol, donateToken } from "@/app/trade/[token]/donate-actions";

interface TipDialogProps {
  creatorName: string;
  mintAddress: string;
  tokenTicker: string;
  trigger?: React.ReactNode;
}

const SOL_PRESETS = [0.01, 0.05, 0.1, 0.5];
const TOKEN_PRESETS = [100, 500, 1000, 5000];

export function TipDialog({
  creatorName,
  mintAddress,
  tokenTicker,
  trigger,
}: TipDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"sol" | "token">("sol");
  const [amount, setAmount] = useState("");
  const [isPending, startTransition] = useTransition();

  const presets = mode === "sol" ? SOL_PRESETS : TOKEN_PRESETS;
  const symbol = mode === "sol" ? "SOL" : `$${tokenTicker}`;

  function handleSend() {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    startTransition(async () => {
      let result;

      if (mode === "sol") {
        const lamports = BigInt(Math.floor(parsed * 1e9)).toString();
        result = await donateSol(mintAddress, lamports);
      } else {
        const rawTokens = BigInt(Math.floor(parsed * 1e6)).toString();
        result = await donateToken(mintAddress, rawTokens);
      }

      if (result.success) {
        toast.success("Tip sent!", {
          description: (
            <a
              href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View transaction
            </a>
          ),
        });
        setAmount("");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Heart className="h-4 w-4" />
            Tip
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Tip {creatorName}</DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex rounded-lg border p-1">
          <button
            type="button"
            onClick={() => {
              setMode("sol");
              setAmount("");
            }}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "sol"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            SOL
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("token");
              setAmount("");
            }}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "token"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ${tokenTicker}
          </button>
        </div>

        {/* Amount input */}
        <div className="relative">
          <input
            type="number"
            min="0"
            step="any"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-12 w-full rounded-lg border bg-background px-4 pr-16 text-lg font-medium outline-none focus:ring-2 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {symbol}
          </span>
        </div>

        {/* Preset amounts */}
        <div className="flex gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(preset.toString())}
              className="flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {preset} {mode === "sol" ? "SOL" : tokenTicker}
            </button>
          ))}
        </div>

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={isPending || !amount}
          className="w-full"
        >
          {isPending ? "Sending..." : `Send ${symbol} Tip`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
