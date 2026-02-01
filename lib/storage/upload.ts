import crypto from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_CONTENT_LENGTH = 5 * 1024 * 1024; // 5MB
const PRESIGN_EXPIRES_SECONDS = 900; // 15 minutes

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

function getR2Client() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 storage not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.",
    );
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function getExtensionFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return map[contentType] || "bin";
}

export function isAllowedContentType(
  contentType: string,
): contentType is AllowedContentType {
  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType);
}

/**
 * Generate a presigned URL for uploading an image to Cloudflare R2.
 *
 * @param userId - The user uploading the file (used in the key path)
 * @param contentType - MIME type of the file (must be image/jpeg, image/png, or image/webp)
 * @returns uploadUrl (presigned PUT URL) and publicUrl (where the file will be accessible)
 */
export async function generatePresignedUploadUrl(
  userId: string,
  contentType: string,
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  if (!isAllowedContentType(contentType)) {
    throw new Error(
      `Invalid content type: ${contentType}. Allowed: ${ALLOWED_CONTENT_TYPES.join(", ")}`,
    );
  }

  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!bucket || !publicUrl) {
    throw new Error("R2 storage not configured. Set R2_BUCKET and R2_PUBLIC_URL.");
  }

  const ext = getExtensionFromContentType(contentType);
  const key = `creators/${userId}/${crypto.randomUUID()}.${ext}`;

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: MAX_CONTENT_LENGTH,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGN_EXPIRES_SECONDS,
  });

  return {
    uploadUrl,
    publicUrl: `${publicUrl.replace(/\/$/, "")}/${key}`,
    key,
  };
}
