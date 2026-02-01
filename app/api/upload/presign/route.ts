import crypto from "node:crypto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { media, creatorProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  generatePresignedUploadUrl,
  generateContentMediaUploadUrl,
  isAllowedContentType,
  isContentMediaType,
} from "@/lib/storage/upload";

type RequestBody = {
  contentType?: string;
  purpose?: "avatar" | "banner" | "post-media";
  postId?: string;
};

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { contentType, purpose = "avatar" } = body;

  if (!contentType || typeof contentType !== "string") {
    return Response.json(
      { error: "contentType is required" },
      { status: 400 },
    );
  }

  // Handle post-media uploads (content images/video)
  if (purpose === "post-media") {
    return handlePostMediaUpload(session, contentType, body.postId);
  }

  // Handle avatar/banner uploads (original behavior)
  if (!isAllowedContentType(contentType)) {
    return Response.json(
      {
        error: `Invalid content type: ${contentType}. Allowed: image/jpeg, image/png, image/webp`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await generatePresignedUploadUrl(
      session.user.id,
      contentType,
    );

    return Response.json({
      uploadUrl: result.uploadUrl,
      publicUrl: result.publicUrl,
    });
  } catch (error) {
    console.error("Failed to generate presigned URL:", error);
    return Response.json(
      { error: "Failed to generate upload URL" },
      { status: 500 },
    );
  }
}

async function handlePostMediaUpload(
  session: { user: { id: string } },
  contentType: string,
  postId?: string,
) {
  // Only allow image types for now; video types handled in Plan 03
  const imageTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!imageTypes.includes(contentType)) {
    return Response.json(
      {
        error: `Invalid content type for post media: ${contentType}. Allowed images: image/jpeg, image/png, image/webp`,
      },
      { status: 400 },
    );
  }

  if (!isContentMediaType(contentType)) {
    return Response.json(
      { error: `Unsupported content type: ${contentType}` },
      { status: 400 },
    );
  }

  // Require creator profile
  const [profile] = await db
    .select()
    .from(creatorProfile)
    .where(eq(creatorProfile.userId, session.user.id))
    .limit(1);

  if (!profile) {
    return Response.json(
      { error: "Creator profile required to upload media" },
      { status: 403 },
    );
  }

  try {
    const mediaId = crypto.randomUUID();
    const mediaType = contentType.startsWith("video/") ? "video" : "image";

    // Generate presigned URL
    const { uploadUrl, key } = await generateContentMediaUploadUrl(
      profile.id,
      contentType,
      mediaId,
    );

    // Create media record
    await db.insert(media).values({
      id: mediaId,
      creatorProfileId: profile.id,
      postId: postId ?? null,
      type: mediaType,
      status: "uploading",
      originalKey: key,
      mimeType: contentType,
    });

    return Response.json({
      uploadUrl,
      mediaId,
      key,
    });
  } catch (error) {
    console.error("Failed to generate content media upload URL:", error);
    return Response.json(
      { error: "Failed to generate upload URL" },
      { status: 500 },
    );
  }
}
