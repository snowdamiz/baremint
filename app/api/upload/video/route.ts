import crypto from "node:crypto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { media, creatorProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateContentMediaUploadUrl } from "@/lib/storage/upload";

/**
 * POST /api/upload/video
 *
 * Creates a media record and returns an R2 presigned URL for uploading
 * the original video. After upload, the client calls POST /api/media/[id]/confirm
 * which scans for CSAM and then creates a Mux direct upload URL.
 *
 * Flow: upload to R2 -> CSAM scan -> Mux direct upload -> Mux transcoding -> webhook
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Require creator profile
  const [profile] = await db
    .select()
    .from(creatorProfile)
    .where(eq(creatorProfile.userId, session.user.id))
    .limit(1);

  if (!profile) {
    return Response.json(
      { error: "Creator profile required" },
      { status: 403 },
    );
  }

  let body: { postId?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { postId } = body;

  try {
    const mediaId = crypto.randomUUID();

    // Create media record with type "video", status "uploading"
    await db.insert(media).values({
      id: mediaId,
      postId: postId ?? null,
      creatorProfileId: profile.id,
      type: "video",
      status: "uploading",
      mimeType: "video/mp4",
    });

    // Generate R2 presigned URL for the original video
    const { uploadUrl, key } = await generateContentMediaUploadUrl(
      profile.id,
      "video/mp4",
      mediaId,
    );

    // Store the R2 key on the media record
    await db
      .update(media)
      .set({ originalKey: key })
      .where(eq(media.id, mediaId));

    return Response.json({
      mediaId,
      r2UploadUrl: uploadUrl,
      r2Key: key,
    });
  } catch (error) {
    console.error("Failed to create video upload:", error);
    return Response.json(
      { error: "Failed to create video upload" },
      { status: 500 },
    );
  }
}
