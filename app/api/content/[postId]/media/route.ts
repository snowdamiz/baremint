import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wallet, creatorToken } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPostById } from "@/lib/content/post-queries";
import { checkContentAccess } from "@/lib/content/access-control";
import {
  generateSignedImageUrl,
  generateSignedPlaybackToken,
  getR2KeyFromPublicUrl,
} from "@/lib/media/signed-urls";

/**
 * GET /api/content/[postId]/media
 *
 * Returns media data for a post. For gated content:
 * - Authorized viewers receive presigned image URLs or signed video playback tokens
 * - Unauthorized viewers receive only blur placeholder URLs
 * - Public posts return media as-is
 *
 * CRITICAL: Original variant URLs and Mux playback IDs are never exposed
 * to unauthorized viewers of gated content.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;

  // Fetch the post with its media
  const postData = await getPostById(postId);

  if (!postData || postData.status !== "published") {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const mediaRecords = postData.media || [];

  // Public posts: return media as-is
  if (postData.accessLevel === "public") {
    return NextResponse.json({
      media: mediaRecords.map((m) => ({
        id: m.id,
        type: m.type,
        status: m.status,
        variants: m.variants,
        muxPlaybackId: m.muxPlaybackId,
        width: m.width,
        height: m.height,
      })),
      isLocked: false,
    });
  }

  // Gated post: check authentication
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    // No session: return locked response with blur URLs only
    return NextResponse.json({
      media: mediaRecords.map((m) => {
        const variants = m.variants as Record<string, string> | null;
        return {
          id: m.id,
          type: m.type,
          blurUrl: variants?.blur ?? null,
          width: m.width,
          height: m.height,
        };
      }),
      isLocked: true,
      accessLevel: postData.accessLevel,
      requiredBalance: postData.tokenThreshold ?? "0",
      viewerBalance: "0",
      tokenTicker: null,
    });
  }

  // Look up viewer's wallet
  const [viewerWallet] = await db
    .select()
    .from(wallet)
    .where(eq(wallet.userId, session.user.id))
    .limit(1);

  // Check content access
  const accessResult = await checkContentAccess(
    {
      accessLevel: postData.accessLevel,
      tokenThreshold: postData.tokenThreshold,
      creatorTokenId: postData.creatorTokenId,
    },
    viewerWallet?.publicKey ?? null,
  );

  // Look up creator token for ticker symbol
  let tokenTicker: string | null = null;
  if (postData.creatorTokenId) {
    const [token] = await db
      .select()
      .from(creatorToken)
      .where(eq(creatorToken.id, postData.creatorTokenId))
      .limit(1);
    tokenTicker = token?.tickerSymbol ?? null;
  }

  if (accessResult.hasAccess) {
    // Authorized: return presigned URLs for images, signed tokens for video
    const signedMedia = await Promise.all(
      mediaRecords.map(async (m) => {
        if (m.type === "image") {
          const variants = m.variants as Record<string, string> | null;
          if (!variants) {
            return {
              id: m.id,
              type: m.type,
              variants: null,
              width: m.width,
              height: m.height,
            };
          }

          // Generate presigned URLs for sm, md, lg variants (NOT blur)
          const signedVariants: Record<string, string> = {};
          for (const size of ["sm", "md", "lg"] as const) {
            if (variants[size]) {
              const key = getR2KeyFromPublicUrl(variants[size]);
              signedVariants[size] = await generateSignedImageUrl(key);
            }
          }

          return {
            id: m.id,
            type: m.type,
            variants: signedVariants,
            width: m.width,
            height: m.height,
          };
        }

        if (m.type === "video" && m.muxPlaybackId) {
          // Generate signed playback and thumbnail tokens
          try {
            const tokens = await generateSignedPlaybackToken(m.muxPlaybackId);
            return {
              id: m.id,
              type: m.type,
              muxPlaybackId: m.muxPlaybackId,
              playbackToken: tokens.playbackToken,
              thumbnailToken: tokens.thumbnailToken,
              width: m.width,
              height: m.height,
            };
          } catch {
            // If signing keys not configured, return playback ID without tokens
            // (non-gated video playback still works via unsigned Mux URLs)
            return {
              id: m.id,
              type: m.type,
              muxPlaybackId: m.muxPlaybackId,
              width: m.width,
              height: m.height,
            };
          }
        }

        return {
          id: m.id,
          type: m.type,
          width: m.width,
          height: m.height,
        };
      }),
    );

    return NextResponse.json({
      media: signedMedia,
      isLocked: false,
    });
  }

  // Unauthorized: return locked response with blur URLs only
  return NextResponse.json({
    media: mediaRecords.map((m) => {
      const variants = m.variants as Record<string, string> | null;
      return {
        id: m.id,
        type: m.type,
        blurUrl: variants?.blur ?? null,
        width: m.width,
        height: m.height,
      };
    }),
    isLocked: true,
    accessLevel: postData.accessLevel,
    requiredBalance: postData.tokenThreshold ?? "0",
    viewerBalance: accessResult.viewerBalance,
    tokenTicker,
  });
}
