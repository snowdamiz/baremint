"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BackupCodes } from "./backup-codes";

type SetupStep = "password" | "qr" | "verify" | "backup";

interface SetupDialogProps {
  trigger: React.ReactNode;
}

export function SetupDialog({ trigger }: SetupDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<SetupStep>("password");
  const [password, setPassword] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function resetState() {
    setStep("password");
    setPassword("");
    setTotpUri("");
    setQrDataUrl("");
    setVerifyCode("");
    setBackupCodes([]);
    setError(null);
  }

  async function handleEnableTotp() {
    setError(null);

    if (!password) {
      setError("Password is required");
      return;
    }

    startTransition(async () => {
      const { data, error: enableError } =
        await authClient.twoFactor.enable({
          password,
        });

      if (enableError) {
        setError(enableError.message ?? "Failed to enable 2FA");
        return;
      }

      if (data?.totpURI) {
        setTotpUri(data.totpURI);
        // Generate QR code client-side
        const QRCode = (await import("qrcode")).default;
        const dataUrl = await QRCode.toDataURL(data.totpURI, {
          width: 200,
          margin: 2,
        });
        setQrDataUrl(dataUrl);
        setBackupCodes(data.backupCodes ?? []);
        setStep("qr");
      }
    });
  }

  async function handleVerifyCode() {
    setError(null);

    if (!verifyCode.trim()) {
      setError("Enter the code from your authenticator app");
      return;
    }

    startTransition(async () => {
      const { error: verifyError } = await authClient.twoFactor.verifyTotp({
        code: verifyCode.trim(),
      });

      if (verifyError) {
        setError(verifyError.message ?? "Invalid code. Try again.");
        return;
      }

      setStep("backup");
    });
  }

  function handleDone() {
    setOpen(false);
    resetState();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetState();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {step === "password" && (
          <>
            <DialogHeader>
              <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
              <DialogDescription>
                Enter your password to begin setting up TOTP two-factor
                authentication.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="2fa-password">Password</Label>
                <Input
                  id="2fa-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleEnableTotp();
                  }}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full"
                onClick={handleEnableTotp}
                disabled={isPending}
              >
                {isPending ? "Setting up..." : "Continue"}
              </Button>
            </div>
          </>
        )}

        {step === "qr" && (
          <>
            <DialogHeader>
              <DialogTitle>Scan QR Code</DialogTitle>
              <DialogDescription>
                Scan this QR code with your authenticator app (Google
                Authenticator, Authy, etc.)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {qrDataUrl && (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="TOTP QR Code"
                    width={200}
                    height={200}
                    className="rounded-lg border"
                  />
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground text-center">
                  Can&apos;t scan? Enter this key manually:
                </p>
                <p className="text-xs font-mono text-center break-all select-all bg-muted p-2 rounded">
                  {totpUri.match(/secret=([^&]+)/)?.[1] ?? ""}
                </p>
              </div>
              <Button className="w-full" onClick={() => setStep("verify")}>
                I&apos;ve scanned the code
              </Button>
            </div>
          </>
        )}

        {step === "verify" && (
          <>
            <DialogHeader>
              <DialogTitle>Verify Setup</DialogTitle>
              <DialogDescription>
                Enter the 6-digit code from your authenticator app to confirm
                setup.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="verify-code">Authentication Code</Label>
                <Input
                  id="verify-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  autoComplete="one-time-code"
                  className="text-center text-lg tracking-widest"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleVerifyCode();
                  }}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full"
                onClick={handleVerifyCode}
                disabled={isPending}
              >
                {isPending ? "Verifying..." : "Verify & Enable"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStep("qr");
                  setError(null);
                  setVerifyCode("");
                }}
                className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Back to QR code
              </button>
            </div>
          </>
        )}

        {step === "backup" && (
          <>
            <DialogHeader>
              <DialogTitle>Save Backup Codes</DialogTitle>
              <DialogDescription>
                These codes can be used to access your account if you lose your
                authenticator device. Each code can only be used once.
              </DialogDescription>
            </DialogHeader>
            <div className="pt-2">
              <BackupCodes codes={backupCodes} onDone={handleDone} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
