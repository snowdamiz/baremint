"use client";

import Image from "next/image";
import Link from "next/link";
import { KycBadge } from "@/components/creator/kyc-badge";
import { VestingTimeline } from "@/components/creator/vesting-timeline";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, ExternalLink, Pencil, Clock } from "lucide-react";
import { useMemo } from "react";

const TOTAL_SUPPLY = 1_000_000_000;
const CREATOR_ALLOCATION_PERCENT = 10;
const COOLDOWN_DAYS = 90;

interface CreatorOwnProfileProps {
  profile: {
    id: string;
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    socialTwitter: string | null;
    socialInstagram: string | null;
    socialYoutube: string | null;
    socialWebsite: string | null;
    kycStatus: string;
    lastTokenLaunchAt: Date | null;
  };
  token: {
    tokenName: string;
    tickerSymbol: string;
    imageUrl: string | null;
    mintAddress: string;
    launchedAt: Date;
  };
}

export function CreatorOwnProfile({ profile, token }: CreatorOwnProfileProps) {
  const isVerified = profile.kycStatus === "approved";
  const creatorAllocation = (TOTAL_SUPPLY * CREATOR_ALLOCATION_PERCENT) / 100;

  const cooldownInfo = useMemo(() => {
    const launchDate = profile.lastTokenLaunchAt
      ? new Date(profile.lastTokenLaunchAt)
      : new Date(token.launchedAt);
    const cooldownEnd = new Date(launchDate);
    cooldownEnd.setDate(cooldownEnd.getDate() + COOLDOWN_DAYS);
    const now = new Date();

    if (now >= cooldownEnd) {
      return { expired: true, daysRemaining: 0 };
    }

    const remaining = Math.ceil(
      (cooldownEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    return { expired: false, daysRemaining: remaining };
  }, [profile.lastTokenLaunchAt, token.launchedAt]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Creator Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your creator profile and token
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/creator/${profile.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <ExternalLink className="h-4 w-4" />
            Public Profile
          </Link>
        </div>
      </div>

      {/* Banner */}
      <div className="relative h-36 w-full overflow-hidden rounded-xl bg-muted sm:h-48">
        {profile.bannerUrl ? (
          <Image
            src={profile.bannerUrl}
            alt=""
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-primary/20 to-primary/5" />
        )}
      </div>

      {/* Avatar + Name */}
      <div className="-mt-12 flex items-end gap-4 px-2 sm:-mt-14">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-background bg-muted sm:h-24 sm:w-24">
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt={profile.displayName}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10 text-2xl font-bold text-primary">
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 pb-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-xl font-bold sm:text-2xl">
              {profile.displayName}
            </h2>
            <KycBadge verified={isVerified} />
          </div>
          {profile.bio && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {profile.bio}
            </p>
          )}
        </div>
      </div>

      {/* Token Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {token.imageUrl && (
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
                <Image
                  src={token.imageUrl}
                  alt={token.tokenName}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div>
              <div className="text-base">{token.tokenName}</div>
              <div className="text-sm font-normal text-muted-foreground">
                ${token.tickerSymbol}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <VestingTimeline
            launchedAt={token.launchedAt}
            totalAllocation={creatorAllocation}
            tickerSymbol={token.tickerSymbol}
          />
        </CardContent>
      </Card>

      {/* Cooldown Status (private to creator) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Launch Cooldown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cooldownInfo.expired ? (
            <p className="text-sm text-success font-medium">
              Cooldown expired &mdash; you can launch a new token
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              You can launch a new token in{" "}
              <span className="font-medium text-foreground">
                {cooldownInfo.daysRemaining} day
                {cooldownInfo.daysRemaining !== 1 ? "s" : ""}
              </span>
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            A 90-day cooldown is enforced between token launches to protect
            investors.
          </p>
        </CardContent>
      </Card>

      {/* Anti-rug Protections */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anti-rug Protections</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {isVerified && (
              <li className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>Creator identity verified (KYC)</span>
              </li>
            )}
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>10% allocation locked in on-chain vesting</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>90-day cooldown between token launches</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
