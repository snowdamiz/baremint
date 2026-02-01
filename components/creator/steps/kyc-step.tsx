"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2,
  ShieldCheck,
  ShieldX,
  RefreshCw,
  CheckCircle2,
  Clock,
} from "lucide-react";
import dynamic from "next/dynamic";

// Dynamically import Sumsub SDK to avoid SSR issues
const SumsubWebSdk = dynamic(
  () => import("@sumsub/websdk-react"),
  { ssr: false },
);

interface KycStepProps {
  kycStatus: string;
  onStatusChange: (status: string) => void;
  onNext: () => void;
}

type KycState = "loading" | "active" | "pending" | "approved" | "rejected" | "error";

export function KycStep({ kycStatus, onStatusChange, onNext }: KycStepProps) {
  const [state, setState] = useState<KycState>(() => {
    if (kycStatus === "approved") return "approved";
    if (kycStatus === "rejected") return "rejected";
    if (kycStatus === "pending") return "pending";
    return "loading";
  });
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const fetchToken = useCallback(async () => {
    setState("loading");
    setAccessToken(null);

    try {
      const res = await fetch("/api/sumsub/token", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to initialize verification");
      }

      const data = await res.json();
      setAccessToken(data.token);
      setState("active");
    } catch (error) {
      console.error("Failed to fetch Sumsub token:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to initialize verification",
      );
      setState("error");
    }
  }, []);

  // Fetch token on mount if not already approved/rejected
  useEffect(() => {
    if (kycStatus !== "approved" && kycStatus !== "rejected" && kycStatus !== "pending") {
      fetchToken();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheckStatus = async () => {
    setPolling(true);
    try {
      const res = await fetch("/api/creator/kyc-status");
      if (!res.ok) throw new Error("Failed to check status");

      const data = await res.json();

      if (data.status === "approved") {
        setState("approved");
        onStatusChange("approved");
      } else if (data.status === "rejected") {
        setState("rejected");
        setRejectionReason(data.rejectionReason);
        onStatusChange("rejected");
      } else if (data.status === "pending") {
        setState("pending");
        onStatusChange("pending");
        toast.info("Your verification is still being reviewed");
      }
    } catch {
      toast.error("Failed to check verification status");
    } finally {
      setPolling(false);
    }
  };

  const handleRetry = () => {
    setRejectionReason(null);
    fetchToken();
  };

  const handleExpirationHandler = useCallback(async () => {
    // Fetch a new token when the current one expires
    try {
      const res = await fetch("/api/sumsub/token", { method: "POST" });
      if (!res.ok) throw new Error("Token refresh failed");
      const data = await res.json();
      return data.token;
    } catch {
      toast.error("Session expired. Please refresh the page.");
      return "";
    }
  }, []);

  const handleMessage = useCallback(
    (type: string) => {
      // When applicant completes submission, switch to pending
      if (
        type === "idCheck.onApplicantSubmitted" ||
        type === "idCheck.onApplicantResubmitted"
      ) {
        setState("pending");
        onStatusChange("pending");
      }
      // When applicant status changes, check it
      if (type === "idCheck.onApplicantStatusChanged") {
        handleCheckStatus();
      }
    },
    [onStatusChange], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleError = useCallback((error: unknown) => {
    console.error("Sumsub SDK error:", error);
    toast.error("Verification widget encountered an error");
  }, []);

  // Approved state
  if (state === "approved") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
          <ShieldCheck className="h-8 w-8 text-green-500" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold">Identity Verified</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your identity has been verified successfully. You can now proceed to
            configure your token.
          </p>
        </div>
        <Button onClick={onNext} className="mt-2">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Continue to Token Setup
        </Button>
      </div>
    );
  }

  // Rejected state
  if (state === "rejected") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold">Verification Rejected</h2>
          {rejectionReason && (
            <p className="mt-2 max-w-md rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              {rejectionReason}
            </p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            You can try again with different documents or a clearer photo.
          </p>
        </div>
        <Button onClick={handleRetry} variant="outline" className="mt-2">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  // Pending state
  if (state === "pending") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
          <Clock className="h-8 w-8 text-amber-500" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold">Verification In Progress</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your documents are being reviewed. This usually takes a few minutes
            but can take up to 24 hours.
          </p>
        </div>
        <Button
          onClick={handleCheckStatus}
          variant="outline"
          disabled={polling}
          className="mt-2"
        >
          {polling ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Check Status
        </Button>
      </div>
    );
  }

  // Loading state
  if (state === "loading") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Initializing identity verification...
        </p>
      </div>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold">Verification Unavailable</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Could not initialize the verification widget. Please try again.
          </p>
        </div>
        <Button onClick={fetchToken} variant="outline" className="mt-2">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  // Active state - Sumsub widget
  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Identity Verification</h2>
        <p className="text-sm text-muted-foreground">
          Complete identity verification to protect your audience. Upload a valid
          ID document and complete a quick liveness check.
        </p>
      </div>

      {accessToken && (
        <div className="min-h-[500px] overflow-hidden rounded-lg border">
          <SumsubWebSdk
            accessToken={accessToken}
            expirationHandler={handleExpirationHandler}
            onMessage={handleMessage}
            onError={handleError}
            config={{
              lang: "en",
            }}
            options={{
              addViewportTag: false,
              adaptIframeHeight: true,
            }}
          />
        </div>
      )}

      <div className="flex justify-center pt-2">
        <Button
          onClick={handleCheckStatus}
          variant="ghost"
          size="sm"
          disabled={polling}
        >
          {polling ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-3 w-3" />
          )}
          Check Status Manually
        </Button>
      </div>
    </div>
  );
}
