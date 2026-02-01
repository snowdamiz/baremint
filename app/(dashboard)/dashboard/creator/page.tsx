import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { creatorProfile, creatorToken } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { OnboardingWizard } from "@/components/creator/onboarding-wizard";
import { CreatorOwnProfile } from "@/components/creator/creator-own-profile";
import type { ProfileData } from "@/components/creator/steps/profile-step";

export default async function CreatorPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth");
  }

  // Check for existing creator profile
  const profile = await db.query.creatorProfile.findFirst({
    where: eq(creatorProfile.userId, session.user.id),
  });

  // If creator has a token, show their own profile view
  if (profile) {
    const token = await db.query.creatorToken.findFirst({
      where: eq(creatorToken.creatorProfileId, profile.id),
    });

    if (token) {
      return (
        <CreatorOwnProfile
          profile={profile}
          token={token}
        />
      );
    }
  }

  // Determine initial step based on profile state
  let initialStep: "profile" | "kyc" | "token-config" = "profile";
  let existingProfile: ProfileData | null = null;

  if (profile) {
    existingProfile = {
      displayName: profile.displayName,
      bio: profile.bio ?? "",
      avatarUrl: profile.avatarUrl ?? "",
      bannerUrl: profile.bannerUrl ?? "",
      socialTwitter: profile.socialTwitter ?? "",
      socialInstagram: profile.socialInstagram ?? "",
      socialYoutube: profile.socialYoutube ?? "",
      socialWebsite: profile.socialWebsite ?? "",
    };

    if (profile.kycStatus === "approved") {
      initialStep = "token-config";
    } else {
      initialStep = "kyc";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {profile ? "Creator Dashboard" : "Become a Creator"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {profile
            ? "Continue setting up your creator account"
            : "Set up your profile and launch your own token"}
        </p>
      </div>

      <OnboardingWizard
        initialStep={initialStep}
        existingProfile={existingProfile}
        initialKycStatus={profile?.kycStatus ?? "none"}
      />
    </div>
  );
}
