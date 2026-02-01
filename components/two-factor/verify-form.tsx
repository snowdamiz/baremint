"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VerifyForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [useBackupCode, setUseBackupCode] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError(useBackupCode ? "Backup code is required" : "Code is required");
      return;
    }

    startTransition(async () => {
      if (useBackupCode) {
        const { error: verifyError } =
          await authClient.twoFactor.verifyBackupCode({
            code: code.trim(),
          });
        if (verifyError) {
          setError(verifyError.message ?? "Invalid backup code");
          return;
        }
      } else {
        const { error: verifyError } = await authClient.twoFactor.verifyTotp({
          code: code.trim(),
        });
        if (verifyError) {
          setError(verifyError.message ?? "Invalid code");
          return;
        }
      }

      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="totp-code">
          {useBackupCode ? "Backup Code" : "Authentication Code"}
        </Label>
        <Input
          id="totp-code"
          type="text"
          inputMode={useBackupCode ? "text" : "numeric"}
          pattern={useBackupCode ? undefined : "[0-9]*"}
          maxLength={useBackupCode ? 10 : 6}
          placeholder={useBackupCode ? "Enter backup code" : "000000"}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="one-time-code"
          autoFocus
          className={useBackupCode ? "" : "text-center text-lg tracking-widest"}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Verifying..." : "Verify"}
      </Button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            setUseBackupCode(!useBackupCode);
            setCode("");
            setError(null);
          }}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {useBackupCode
            ? "Use authenticator code instead"
            : "Use backup code instead"}
        </button>
      </div>
    </form>
  );
}
