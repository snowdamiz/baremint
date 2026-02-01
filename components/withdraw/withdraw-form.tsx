"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AddressBook } from "./address-book";
import { saveAddress } from "@/app/(dashboard)/dashboard/withdraw/actions";

interface SavedAddress {
  id: string;
  address: string;
  label: string;
}

interface WithdrawFormProps {
  maxSol: number;
  solPrice: number;
  savedAddresses: SavedAddress[];
}

export function WithdrawForm({
  maxSol,
  solPrice,
  savedAddresses,
}: WithdrawFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [saveAddr, setSaveAddr] = useState(false);
  const [addrLabel, setAddrLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const amountNum = parseFloat(amount) || 0;
  const usdEquivalent = amountNum * solPrice;

  function handleSelectAddress(address: string) {
    setDestination(address);
  }

  function handleMax() {
    // Leave a small amount for network fee (~0.000005 SOL)
    const max = Math.max(0, maxSol - 0.000005);
    setAmount(max > 0 ? max.toFixed(9) : "0");
  }

  function handleContinue() {
    setError(null);

    if (!destination.trim()) {
      setError("Destination address is required");
      return;
    }

    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(destination.trim())) {
      setError("Invalid Solana address");
      return;
    }

    if (amountNum <= 0) {
      setError("Amount must be greater than zero");
      return;
    }

    if (amountNum > maxSol) {
      setError("Insufficient balance");
      return;
    }

    startTransition(async () => {
      // Save address if requested
      if (saveAddr && addrLabel.trim()) {
        await saveAddress(destination.trim(), addrLabel.trim());
      }

      // Convert SOL to lamports
      const lamports = Math.floor(amountNum * 1_000_000_000);

      // Navigate to review page with query params
      const params = new URLSearchParams({
        to: destination.trim(),
        amount: lamports.toString(),
        sol: amountNum.toFixed(9),
        usd: usdEquivalent.toFixed(2),
      });

      router.push(`/dashboard/withdraw/review?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-6">
      <AddressBook
        addresses={savedAddresses}
        onSelect={handleSelectAddress}
      />

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="destination">Destination Address</Label>
          <Input
            id="destination"
            type="text"
            placeholder="Enter Solana address"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="amount">Amount (SOL)</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto py-0 px-1 text-xs text-primary"
              onClick={handleMax}
            >
              Max
            </Button>
          </div>
          <Input
            id="amount"
            type="number"
            step="0.000000001"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {amountNum > 0 && (
            <p className="text-sm text-muted-foreground">
              ~${usdEquivalent.toFixed(2)} USD
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="save-address"
              checked={saveAddr}
              onCheckedChange={(checked) => setSaveAddr(checked === true)}
            />
            <Label
              htmlFor="save-address"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Save this address for future use
            </Label>
          </div>

          {saveAddr && (
            <div className="space-y-2 pl-6">
              <Label htmlFor="addr-label">Address Label</Label>
              <Input
                id="addr-label"
                type="text"
                placeholder="e.g. My Phantom Wallet"
                value={addrLabel}
                onChange={(e) => setAddrLabel(e.target.value)}
              />
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          className="w-full"
          onClick={handleContinue}
          disabled={isPending}
        >
          {isPending ? "Processing..." : "Continue to Review"}
        </Button>
      </div>
    </div>
  );
}
