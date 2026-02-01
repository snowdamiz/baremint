import crypto from "node:crypto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { media, moderationAction, post } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { scanMediaForCSAM } from "@/lib/media/csam-scan";
import { getMuxClient } from "@/lib/mux/client";

/**
 * POST /api/media/[id]/confirm
 *
 * Called after the client finishes uploading the original file to R2.
 * Triggers the scan -> process pipeline:
 *
 * For images: CSAM scan -> Sharp processing -> ready (handled by 04-02 if extended)
 * For videos: CSAM scan -> create Mux direct upload -> return Mux upload URL
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: mediaId } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch media record
  const [mediaRecord] = await db
    .select()
    .from(media)
    .where(eq(media.id, mediaId))
    .limit(1);

  if (!mediaRecord) {
    return Response.json({ error: "Media not found" }, { status: 404 });
  }

  // Verify ownership: media must belong to user's creator profile
  // (Auth check via creatorProfile -> userId relationship)
  const { creatorProfile } = await import("@/lib/db/schema");
  const [profile] = await db
    .select()
    .from(creatorProfile)
    .where(
      and(
        eq(creatorProfile.id, mediaRecord.creatorProfileId),
        eq(creatorProfile.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!profile) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Prevent reprocessing
  if (mediaRecord.status !== "uploading") {
    return Response.json(
      { error: `Media is already ${mediaRecord.status}, cannot reprocess` },
      { status: 409 },
    );
  }

  if (mediaRecord.type === "video") {
    return handleVideoConfirm(mediaRecord);
  }

  if (mediaRecord.type === "image") {
    return handleImageConfirm(mediaRecord);
  }

  return Response.json(
    { error: `Unsupported media type: ${mediaRecord.type}` },
    { status: 400 },
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleVideoConfirm(mediaRecord: any) {
  try {
    // Step 1: Update status to scanning
    await db
      .update(media)
      .set({ status: "scanning" })
      .where(eq(media.id, mediaRecord.id));

    // Step 2: Build R2 public URL and scan for CSAM
    const publicUrl = getR2PublicUrl(mediaRecord.originalKey);
    const scanResult = await scanMediaForCSAM(publicUrl);

    if (scanResult.flagged) {
      // Flag the media
      await db
        .update(media)
        .set({ status: "flagged" })
        .where(eq(media.id, mediaRecord.id));

      // Create moderation action record
      await db.insert(moderationAction).values({
        id: crypto.randomUUID(),
        mediaId: mediaRecord.id,
        postId: mediaRecord.postId,
        action: "flag_csam",
        reason: scanResult.reason ?? "unknown",
        confidence: scanResult.confidence?.toString(),
        createdAt: new Date(),
      });

      // Put parent post under review if it exists
      if (mediaRecord.postId) {
        await db
          .update(post)
          .set({ status: "under_review", updatedAt: new Date() })
          .where(eq(post.id, mediaRecord.postId));
      }

      return Response.json({ status: "flagged" });
    }

    // Step 3: CSAM scan passed -- create Mux direct upload
    await db
      .update(media)
      .set({ status: "processing" })
      .where(eq(media.id, mediaRecord.id));

    const mux = getMuxClient();
    const origin =
      process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

    const upload = await mux.video.uploads.create({
      cors_origin: origin,
      new_asset_settings: {
        passthrough: mediaRecord.id,
        playback_policies: ["public"],
        video_quality: "basic",
        max_resolution_tier: "1080p",
      },
      // 10 minutes = 600 seconds timeout for upload
      timeout: 3600,
    });

    // Store Mux upload ID on media record
    await db
      .update(media)
      .set({ muxUploadId: upload.id })
      .where(eq(media.id, mediaRecord.id));

    return Response.json({
      status: "processing",
      muxUploadUrl: upload.url,
    });
  } catch (error) {
    console.error("Video confirm failed:", error);

    // Mark media as failed
    await db
      .update(media)
      .set({ status: "failed" })
      .where(eq(media.id, mediaRecord.id));

    return Response.json(
      { error: "Video processing failed" },
      { status: 500 },
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleImageConfirm(mediaRecord: any) {
  // Image handling is the primary responsibility of Plan 04-02.
  // This provides a minimal implementation that Plan 04-02 can extend
  // with Sharp processing.
  try {
    // Step 1: Update status to scanning
    await db
      .update(media)
      .set({ status: "scanning" })
      .where(eq(media.id, mediaRecord.id));

    // Step 2: Build R2 public URL and scan for CSAM
    const publicUrl = getR2PublicUrl(mediaRecord.originalKey);
    const scanResult = await scanMediaForCSAM(publicUrl);

    if (scanResult.flagged) {
      await db
        .update(media)
        .set({ status: "flagged" })
        .where(eq(media.id, mediaRecord.id));

      await db.insert(moderationAction).values({
        id: crypto.randomUUID(),
        mediaId: mediaRecord.id,
        postId: mediaRecord.postId,
        action: "flag_csam",
        reason: scanResult.reason ?? "unknown",
        confidence: scanResult.confidence?.toString(),
        createdAt: new Date(),
      });

      if (mediaRecord.postId) {
        await db
          .update(post)
          .set({ status: "under_review", updatedAt: new Date() })
          .where(eq(post.id, mediaRecord.postId));
      }

      return Response.json({ status: "flagged" });
    }

    // Step 3: CSAM scan passed -- process image
    // Try to use Sharp processing if available (Plan 04-02)
    await db
      .update(media)
      .set({ status: "processing" })
      .where(eq(media.id, mediaRecord.id));

    try {
      const { processUploadedImage, downloadFromR2 } = await import(
        "@/lib/media/image-processing"
      );
      const buffer = await downloadFromR2(mediaRecord.originalKey);
      const variants = await processUploadedImage(
        buffer,
        mediaRecord.originalKey,
      );

      await db
        .update(media)
        .set({ status: "ready", variants })
        .where(eq(media.id, mediaRecord.id));

      // Check if parent post should be published
      await maybePublishPost(mediaRecord.postId);

      return Response.json({ status: "ready", variants });
    } catch {
      // If Sharp processing is not available, mark as ready without variants
      await db
        .update(media)
        .set({ status: "ready" })
        .where(eq(media.id, mediaRecord.id));

      await maybePublishPost(mediaRecord.postId);

      return Response.json({ status: "ready" });
    }
  } catch (error) {
    console.error("Image confirm failed:", error);

    await db
      .update(media)
      .set({ status: "failed" })
      .where(eq(media.id, mediaRecord.id));

    return Response.json(
      { error: "Image processing failed" },
      { status: 500 },
    );
  }
}

function getR2PublicUrl(key: string | null): string {
  if (!key) {
    throw new Error("Media has no original key");
  }

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error("R2_PUBLIC_URL is not configured");
  }

  return `${publicUrl.replace(/\/$/, "")}/${key}`;
}

/**
 * If all media for a post are "ready" and the post is "processing",
 * transition the post to "published".
 */
async function maybePublishPost(postId: string | null) {
  if (!postId) return;

  const postMedia = await db
    .select()
    .from(media)
    .where(eq(media.postId, postId));

  const allReady = postMedia.every((m) => m.status === "ready");

  if (!allReady) return;

  const [parentPost] = await db
    .select()
    .from(post)
    .where(eq(post.id, postId))
    .limit(1);

  if (parentPost && parentPost.status === "processing") {
    await db
      .update(post)
      .set({
        status: "published",
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(post.id, postId));
  }
}
