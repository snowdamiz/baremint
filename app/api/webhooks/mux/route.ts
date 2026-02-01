import { getMuxClient } from "@/lib/mux/client";
import { db } from "@/lib/db";
import { media, post } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { uploadToR2 } from "@/lib/media/image-processing";
import type {
  VideoAssetReadyWebhookEvent,
  VideoAssetErroredWebhookEvent,
  VideoUploadCancelledWebhookEvent,
} from "@mux/mux-node/resources/webhooks";

/**
 * POST /api/webhooks/mux
 *
 * Handles Mux webhook events for video asset lifecycle.
 * Signature is verified before processing.
 * Always returns 200 after signature verification to prevent retry storms.
 * All handlers are idempotent.
 */
export async function POST(req: Request) {
  const mux = getMuxClient();

  // Read raw body for signature verification
  const body = await req.text();
  const webhookHeaders = Object.fromEntries(req.headers.entries());

  // Verify webhook signature -- return 401 if invalid
  let event;
  try {
    event = mux.webhooks.unwrap(body, webhookHeaders);
  } catch (error) {
    console.error("Mux webhook signature verification failed:", error);
    return new Response("Invalid signature", { status: 401 });
  }

  // After signature verification, always return 200 to prevent retry storms
  try {
    switch (event.type) {
      case "video.asset.ready":
        await handleAssetReady(event as VideoAssetReadyWebhookEvent);
        break;

      case "video.asset.errored":
        await handleAssetErrored(event as VideoAssetErroredWebhookEvent);
        break;

      case "video.upload.cancelled":
        await handleUploadCancelled(
          event as VideoUploadCancelledWebhookEvent,
        );
        break;

      default:
        // Acknowledge but ignore other event types
        break;
    }
  } catch (error) {
    // Log the error but return 200 to prevent Mux retry storms
    console.error(
      `Mux webhook processing error for event ${event.type}:`,
      error,
    );
  }

  return new Response("OK", { status: 200 });
}

/**
 * Handle video.asset.ready: Video transcoding is complete.
 *
 * Updates media record with playbackId, duration, and status.
 * Publishes parent post if all media is ready.
 * Idempotent: skips if playbackId already set.
 */
async function handleAssetReady(event: VideoAssetReadyWebhookEvent) {
  const asset = event.data;
  const mediaId = asset.passthrough;

  if (!mediaId) {
    console.warn("Mux asset.ready event missing passthrough (mediaId)");
    return;
  }

  const playbackId = asset.playback_ids?.[0]?.id;
  if (!playbackId) {
    console.warn(`Mux asset ${asset.id} has no playback IDs`);
    return;
  }

  // Fetch media record
  const [mediaRecord] = await db
    .select()
    .from(media)
    .where(eq(media.id, mediaId))
    .limit(1);

  if (!mediaRecord) {
    console.warn(`Media record not found for ID: ${mediaId}`);
    return;
  }

  // IDEMPOTENCY: If playbackId is already set, this event was already processed
  if (mediaRecord.muxPlaybackId) {
    return;
  }

  const duration = asset.duration
    ? Math.round(asset.duration)
    : null;

  // Generate video blur placeholder from Mux thumbnail
  // This runs before marking media as ready so the blur variant is available
  // when content gating checks happen. Errors are non-fatal.
  let updatedVariants = (mediaRecord.variants as Record<string, string>) ?? {};
  try {
    const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?width=400`;
    const thumbResponse = await fetch(thumbnailUrl);
    if (thumbResponse.ok) {
      const thumbBuffer = Buffer.from(await thumbResponse.arrayBuffer());
      const blurBuffer = await sharp(thumbBuffer)
        .resize(40, undefined, { fit: "inside", withoutEnlargement: true })
        .blur(20)
        .resize(400, undefined, {
          fit: "inside",
          withoutEnlargement: true,
          kernel: "cubic",
        })
        .webp({ quality: 60 })
        .toBuffer();

      const blurKey = `content/${mediaRecord.creatorProfileId}/${mediaId}/blur.webp`;
      await uploadToR2(blurKey, blurBuffer, "image/webp");

      const publicUrlBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
      if (publicUrlBase) {
        updatedVariants = { ...updatedVariants, blur: `${publicUrlBase}/${blurKey}` };
      }
    }
  } catch (error) {
    console.error(`Failed to generate video blur placeholder for media ${mediaId}:`, error);
    // Non-fatal: continue without blur variant
  }

  // Update media record
  await db
    .update(media)
    .set({
      muxAssetId: asset.id,
      muxPlaybackId: playbackId,
      duration,
      status: "ready",
      variants: updatedVariants,
    })
    .where(eq(media.id, mediaId));

  // Check if parent post should be published
  if (mediaRecord.postId) {
    await maybePublishPost(mediaRecord.postId);
  }
}

/**
 * Handle video.asset.errored: Video transcoding failed.
 * Updates media status to "failed".
 */
async function handleAssetErrored(event: VideoAssetErroredWebhookEvent) {
  const asset = event.data;
  const mediaId = asset.passthrough;

  if (!mediaId) {
    console.warn("Mux asset.errored event missing passthrough (mediaId)");
    return;
  }

  await db
    .update(media)
    .set({ status: "failed" })
    .where(eq(media.id, mediaId));
}

/**
 * Handle video.upload.cancelled: Upload was cancelled.
 * Updates media status to "failed".
 *
 * Note: The upload object's new_asset_settings.passthrough contains the mediaId.
 */
async function handleUploadCancelled(
  event: VideoUploadCancelledWebhookEvent,
) {
  const upload = event.data;
  // For upload events, passthrough is in the new_asset_settings
  const mediaId = (upload as { new_asset_settings?: { passthrough?: string } })
    .new_asset_settings?.passthrough;

  if (!mediaId) {
    console.warn("Mux upload.cancelled event missing passthrough (mediaId)");
    return;
  }

  await db
    .update(media)
    .set({ status: "failed" })
    .where(eq(media.id, mediaId));
}

/**
 * If all media for a post are "ready" and the post is "processing",
 * transition the post to "published" with publishedAt = now.
 */
async function maybePublishPost(postId: string) {
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
