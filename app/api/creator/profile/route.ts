import crypto from "node:crypto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { creatorProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.query.creatorProfile.findFirst({
    where: eq(creatorProfile.userId, session.user.id),
  });

  return Response.json({ profile: profile ?? null });
}

interface ProfileInput {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  socialTwitter?: string;
  socialInstagram?: string;
  socialYoutube?: string;
  socialWebsite?: string;
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ProfileInput;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { displayName, bio, avatarUrl, bannerUrl, socialTwitter, socialInstagram, socialYoutube, socialWebsite } = body;

  // Check for existing profile
  const existing = await db.query.creatorProfile.findFirst({
    where: eq(creatorProfile.userId, session.user.id),
  });

  if (existing) {
    // Update existing profile -- displayName is immutable after creation
    const updated = await db
      .update(creatorProfile)
      .set({
        bio: bio ?? existing.bio,
        avatarUrl: avatarUrl ?? existing.avatarUrl,
        bannerUrl: bannerUrl ?? existing.bannerUrl,
        socialTwitter: socialTwitter ?? existing.socialTwitter,
        socialInstagram: socialInstagram ?? existing.socialInstagram,
        socialYoutube: socialYoutube ?? existing.socialYoutube,
        socialWebsite: socialWebsite ?? existing.socialWebsite,
        updatedAt: new Date(),
      })
      .where(eq(creatorProfile.id, existing.id))
      .returning();

    return Response.json({ profile: updated[0] });
  }

  // Create new profile -- displayName required
  if (!displayName || typeof displayName !== "string") {
    return Response.json(
      { error: "displayName is required" },
      { status: 400 },
    );
  }

  const trimmed = displayName.trim();
  if (trimmed.length < 2 || trimmed.length > 50) {
    return Response.json(
      { error: "displayName must be between 2 and 50 characters" },
      { status: 400 },
    );
  }

  const newProfile = await db
    .insert(creatorProfile)
    .values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      displayName: trimmed,
      bio: bio ?? null,
      avatarUrl: avatarUrl ?? null,
      bannerUrl: bannerUrl ?? null,
      socialTwitter: socialTwitter ?? null,
      socialInstagram: socialInstagram ?? null,
      socialYoutube: socialYoutube ?? null,
      socialWebsite: socialWebsite ?? null,
    })
    .returning();

  return Response.json({ profile: newProfile[0] }, { status: 201 });
}
