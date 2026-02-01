"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface BackupCodesProps {
  codes: string[];
  onDone: () => void;
}

export function BackupCodes({ codes, onDone }: BackupCodesProps) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopyAll() {
    const text = codes.join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/50 p-4">
        {codes.map((code, i) => (
          <code
            key={i}
            className="text-sm font-mono text-center py-1 select-all"
          >
            {code}
          </code>
        ))}
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={handleCopyAll}
      >
        {copied ? "Copied!" : "Copy all codes"}
      </Button>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="saved-codes"
          checked={saved}
          onCheckedChange={(checked) => setSaved(checked === true)}
        />
        <Label
          htmlFor="saved-codes"
          className="text-sm text-muted-foreground cursor-pointer"
        >
          I have saved these codes in a safe place
        </Label>
      </div>

      <Button className="w-full" disabled={!saved} onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
