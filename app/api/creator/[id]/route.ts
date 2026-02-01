import { db } from "@/lib/db";
import { creatorProfile, creatorToken } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const profile = await db.query.creatorProfile.findFirst({
    where: eq(creatorProfile.id, id),
  });

  if (!profile) {
    return Response.json({ error: "Creator not found" }, { status: 404 });
  }

  // Find associated token
  const token = await db.query.creatorToken.findFirst({
    where: eq(creatorToken.creatorProfileId, profile.id),
  });

  return Response.json({
    profile: {
      id: profile.id,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      bannerUrl: profile.bannerUrl,
      socials: {
        twitter: profile.socialTwitter,
        instagram: profile.socialInstagram,
        youtube: profile.socialYoutube,
        website: profile.socialWebsite,
      },
      kycStatus: profile.kycStatus,
      createdAt: profile.createdAt,
    },
    token: token
      ? {
          tokenName: token.tokenName,
          tickerSymbol: token.tickerSymbol,
          imageUrl: token.imageUrl,
          mintAddress: token.mintAddress,
          launchedAt: token.launchedAt,
        }
      : null,
  });
}
