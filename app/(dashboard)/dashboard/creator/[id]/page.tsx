import Image from "next/image";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creatorProfile, creatorToken } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { KycBadge } from "@/components/creator/kyc-badge";
import { VestingTimeline } from "@/components/creator/vesting-timeline";
import { PostFeed } from "@/components/content/post-feed";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { TipDialog } from "@/components/donate/tip-dialog";

const TOTAL_SUPPLY = 1_000_000_000;
const CREATOR_ALLOCATION_PERCENT = 10;

interface SocialLinkProps {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function SocialLink({ href, label, icon }: SocialLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {icon}
      {label}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

export default async function CreatorPublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await db.query.creatorProfile.findFirst({
    where: eq(creatorProfile.id, id),
  });

  if (!profile) {
    notFound();
  }

  const token = await db.query.creatorToken.findFirst({
    where: eq(creatorToken.creatorProfileId, profile.id),
  });

  // Determine if the current user is the owner of this profile
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const isOwner = session?.user?.id === profile.userId;

  const isVerified = profile.kycStatus === "approved";
  const creatorAllocation = (TOTAL_SUPPLY * CREATOR_ALLOCATION_PERCENT) / 100;

  return (
    <div className="space-y-6">
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
            <h1 className="truncate text-xl font-bold sm:text-2xl">
              {profile.displayName}
            </h1>
            <KycBadge verified={isVerified} />
          </div>
          {profile.bio && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {profile.bio}
            </p>
          )}
        </div>
      </div>

      {/* Tip Button (only for non-owners when token exists) */}
      {!isOwner && token && (
        <div className="px-2">
          <TipDialog
            creatorName={profile.displayName}
            mintAddress={token.mintAddress}
            tokenTicker={token.tickerSymbol}
          />
        </div>
      )}

      {/* Social Links */}
      {(profile.socialTwitter ||
        profile.socialInstagram ||
        profile.socialYoutube ||
        profile.socialWebsite) && (
        <div className="flex flex-wrap gap-2 px-2">
          {profile.socialTwitter && (
            <SocialLink
              href={`https://x.com/${profile.socialTwitter}`}
              label={`@${profile.socialTwitter}`}
              icon={
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              }
            />
          )}
          {profile.socialInstagram && (
            <SocialLink
              href={`https://instagram.com/${profile.socialInstagram}`}
              label={`@${profile.socialInstagram}`}
              icon={
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              }
            />
          )}
          {profile.socialYoutube && (
            <SocialLink
              href={`https://youtube.com/@${profile.socialYoutube}`}
              label={profile.socialYoutube}
              icon={
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              }
            />
          )}
          {profile.socialWebsite && (
            <SocialLink
              href={
                profile.socialWebsite.startsWith("http")
                  ? profile.socialWebsite
                  : `https://${profile.socialWebsite}`
              }
              label="Website"
              icon={<ExternalLink className="h-3.5 w-3.5" />}
            />
          )}
        </div>
      )}

      {/* Token Section */}
      {token ? (
        <div className="space-y-4">
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
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              This creator hasn&apos;t launched a token yet.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Post Feed */}
      <PostFeed
        creatorProfileId={profile.id}
        creatorName={profile.displayName}
        creatorAvatar={profile.avatarUrl}
        isOwner={isOwner}
      />
    </div>
  );
}
