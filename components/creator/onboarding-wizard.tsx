"use client";

import { useState } from "react";
import { ProfileStep, type ProfileData } from "@/components/creator/steps/profile-step";
import { KycStep } from "@/components/creator/steps/kyc-step";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "profile", label: "Profile" },
  { id: "kyc", label: "Verification" },
  { id: "token-config", label: "Token" },
  { id: "launch-review", label: "Review" },
  { id: "launch-success", label: "Launch" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

interface OnboardingWizardProps {
  initialStep?: StepId;
  existingProfile?: ProfileData | null;
  initialKycStatus?: string;
}

export function OnboardingWizard({
  initialStep = "profile",
  existingProfile,
  initialKycStatus = "none",
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<StepId>(initialStep);
  const [saving, setSaving] = useState(false);
  const [kycStatus, setKycStatus] = useState(initialKycStatus);
  const [profileData, setProfileData] = useState<ProfileData>(
    existingProfile ?? {
      displayName: "",
      bio: "",
      avatarUrl: "",
      bannerUrl: "",
      socialTwitter: "",
      socialInstagram: "",
      socialYoutube: "",
      socialWebsite: "",
    },
  );

  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  async function handleProfileComplete() {
    setSaving(true);
    try {
      const res = await fetch("/api/creator/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save profile");
      }

      toast.success("Profile saved successfully");
      setCurrentStep("kyc");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save profile",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <nav aria-label="Onboarding progress">
        <ol className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <li
                key={step.id}
                className="flex flex-1 items-center last:flex-none"
              >
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                      isCompleted &&
                        "border-primary bg-primary text-primary-foreground",
                      isCurrent &&
                        "border-primary bg-background text-primary",
                      !isCompleted &&
                        !isCurrent &&
                        "border-muted-foreground/25 text-muted-foreground",
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      "hidden text-[10px] font-medium sm:block",
                      isCurrent
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 h-0.5 flex-1",
                      isCompleted ? "bg-primary" : "bg-muted-foreground/25",
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step Content */}
      <div className="rounded-xl border bg-card p-4 shadow-card sm:p-6">
        {currentStep === "profile" && (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold">Set Up Your Profile</h2>
              <p className="text-sm text-muted-foreground">
                Tell your audience who you are. This information will be visible
                on your creator page.
              </p>
            </div>
            <ProfileStep
              data={profileData}
              onChange={setProfileData}
              onNext={handleProfileComplete}
              isExistingProfile={!!existingProfile}
            />
          </>
        )}

        {currentStep === "kyc" && (
          <KycStep
            kycStatus={kycStatus}
            onStatusChange={setKycStatus}
            onNext={() => setCurrentStep("token-config")}
          />
        )}

        {currentStep === "token-config" && (
          <div className="py-12 text-center">
            <h2 className="text-lg font-semibold">Configure Your Token</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Set up your creator token with a name, ticker, and image.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">Coming soon</p>
          </div>
        )}

        {currentStep === "launch-review" && (
          <div className="py-12 text-center">
            <h2 className="text-lg font-semibold">Review & Launch</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Review your token details before launching.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">Coming soon</p>
          </div>
        )}

        {currentStep === "launch-success" && (
          <div className="py-12 text-center">
            <h2 className="text-lg font-semibold">Launch Complete</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your token has been successfully launched.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">Coming soon</p>
          </div>
        )}
      </div>

      {/* Saving overlay */}
      {saving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50">
          <div className="rounded-lg border bg-card p-4 shadow-lg">
            <p className="text-sm font-medium">Saving profile...</p>
          </div>
        </div>
      )}
    </div>
  );
}
