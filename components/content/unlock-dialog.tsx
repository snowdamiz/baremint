"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock, Flame } from "lucide-react";

interface UnlockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  accessLevel: "hold_gated" | "burn_gated";
  requiredBalance: string;
  viewerBalance: string;
  tokenTicker: string;
  creatorTokenId: string;
}

export function UnlockDialog({
  isOpen,
  onClose,
  accessLevel,
  requiredBalance,
  viewerBalance,
  tokenTicker,
}: UnlockDialogProps) {
  const required = Number(requiredBalance) || 0;
  const viewer = Number(viewerBalance) || 0;
  const progress = required > 0 ? Math.min((viewer / required) * 100, 100) : 0;
  const hasEnough = viewer >= required && required > 0;

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
            Unlock This Content
          </DialogTitle>
          <DialogDescription>
            {accessLevel === "hold_gated"
              ? `Hold ${requiredBalance} $${tokenTicker} tokens to access this creator's gated content`
              : `Burn ${requiredBalance} $${tokenTicker} tokens for permanent access to this post`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Balance comparison */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your balance</span>
              <span className="font-medium">
                {viewerBalance} / {requiredBalance} ${tokenTicker}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  hasEnough ? "bg-green-500" : "bg-primary"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Success message if viewer has enough */}
          {hasEnough && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
              You have enough tokens! Access will be granted automatically.
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => toast("Trading coming soon")}
              className="w-full"
            >
              Buy ${tokenTicker} Tokens
            </Button>

            {accessLevel === "burn_gated" && (
              <Button
                variant="secondary"
                onClick={() => toast("Burn-to-unlock coming soon")}
                className="w-full"
              >
                <Flame className="h-4 w-4" />
                Burn to Unlock
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
