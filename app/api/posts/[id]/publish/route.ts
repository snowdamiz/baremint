import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { creatorProfile, creatorToken } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { publishPost } from "@/lib/content/post-queries";
import { notifyTokenHoldersByCreator } from "@/lib/notifications/create";
import { z } from "zod";

const publishBodySchema = z.object({
  accessLevel: z
    .enum(["public", "hold_gated", "burn_gated"])
    .default("public"),
  tokenThreshold: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.query.creatorProfile.findFirst({
    where: eq(creatorProfile.userId, session.user.id),
  });

  if (!profile) {
    return Response.json(
      { error: "Creator profile not found" },
      { status: 403 },
    );
  }

  // Parse request body (may be empty for public posts)
  let body: z.infer<typeof publishBodySchema> = { accessLevel: "public" };
  try {
    const raw = await req.json().catch(() => ({}));
    body = publishBodySchema.parse(raw);
  } catch {
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { accessLevel, tokenThreshold } = body;

  // Validate gated post requirements
  let tokenId: string | null = null;
  if (accessLevel !== "public") {
    // Require tokenThreshold
    if (!tokenThreshold) {
      return Response.json(
        { error: "Token threshold is required for gated content" },
        { status: 400 },
      );
    }

    // Validate tokenThreshold is a valid BigInt string
    try {
      const parsed = BigInt(tokenThreshold);
      if (parsed <= BigInt(0)) {
        return Response.json(
          { error: "Token threshold must be a positive number" },
          { status: 400 },
        );
      }
    } catch {
      return Response.json(
        { error: "Token threshold must be a valid integer" },
        { status: 400 },
      );
    }

    // Look up creator's token
    const token = await db.query.creatorToken.findFirst({
      where: eq(creatorToken.creatorProfileId, profile.id),
    });

    if (!token) {
      return Response.json(
        { error: "You must launch a token before creating gated content" },
        { status: 403 },
      );
    }

    tokenId = token.id;
  }

  const published = await publishPost(id, profile.id, {
    accessLevel,
    tokenThreshold: tokenThreshold ?? null,
    creatorTokenId: tokenId,
  });

  if (!published) {
    return Response.json(
      { error: "Post not found or not a draft" },
      { status: 404 },
    );
  }

  // Notify token holders about new content (non-fatal)
  notifyTokenHoldersByCreator(
    profile.id,
    "New post from " + profile.displayName,
    published.content?.substring(0, 100) || "Check out their latest post",
    `/dashboard/creator/${profile.id}`,
  ).catch((err) => console.error("Notification fan-out error:", err));

  return Response.json({ post: published });
}
