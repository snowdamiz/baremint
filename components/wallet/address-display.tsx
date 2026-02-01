"use client";

import { useState } from "react";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AddressDisplayProps {
  address: string;
}

export function AddressDisplay({ address }: AddressDisplayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Your Wallet
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-xs"
          onClick={() => setIsVisible(!isVisible)}
        >
          {isVisible ? (
            <>
              <EyeOff className="h-3 w-3" />
              Hide
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" />
              Show
            </>
          )}
        </Button>
      </div>

      <div className="bg-muted/50 flex items-center gap-2 rounded-md px-3 py-2">
        <code className="flex-1 truncate text-xs font-mono">
          {isVisible ? address : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
        </code>
        {isVisible && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 shrink-0 p-0"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
