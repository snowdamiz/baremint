import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client } from "@/lib/storage/upload";
import { getMuxClient } from "@/lib/mux/client";

/**
 * Generate a presigned GET URL for an R2 object.
 *
 * Used to provide time-limited access to gated image content.
 * The viewer must pass token balance checks before receiving this URL.
 *
 * @param key - R2 object key (e.g. "content/xyz/abc/lg.webp")
 * @param expiresInSeconds - URL validity duration (default 5 minutes)
 * @returns Presigned URL string
 */
export async function generateSignedImageUrl(
  key: string,
  expiresInSeconds = 300,
): Promise<string> {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    throw new Error("R2_BUCKET is not configured.");
  }

  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });
}

/**
 * Generate signed playback and thumbnail tokens for a Mux video.
 *
 * Used to provide time-limited access to gated video content.
 * The viewer must pass token balance checks before receiving these tokens.
 *
 * Requires MUX_SIGNING_KEY_ID and MUX_PRIVATE_KEY environment variables.
 *
 * @param playbackId - Mux playback ID
 * @param expirationMinutes - Token validity duration (default 15 minutes)
 * @returns Playback token and thumbnail token
 */
export async function generateSignedPlaybackToken(
  playbackId: string,
  expirationMinutes = 15,
): Promise<{ playbackToken: string; thumbnailToken: string }> {
  const mux = getMuxClient();

  const playbackToken = await mux.jwt.signPlaybackId(playbackId, {
    type: "video",
    expiration: `${expirationMinutes}m`,
  });

  const thumbnailToken = await mux.jwt.signPlaybackId(playbackId, {
    type: "thumbnail",
    expiration: `${expirationMinutes}m`,
  });

  return { playbackToken, thumbnailToken };
}

/**
 * Extract the R2 object key from a public URL.
 *
 * Strips the R2_PUBLIC_URL prefix to get the raw key for use
 * with presigned URL generation or direct R2 operations.
 *
 * @example
 * getR2KeyFromPublicUrl("https://cdn.example.com/content/xyz/abc/lg.webp")
 * // => "content/xyz/abc/lg.webp"
 */
export function getR2KeyFromPublicUrl(publicUrl: string): string {
  const publicUrlBase = process.env.R2_PUBLIC_URL;
  if (!publicUrlBase) {
    throw new Error("R2_PUBLIC_URL is not configured.");
  }

  const cleanBase = publicUrlBase.replace(/\/$/, "");
  if (!publicUrl.startsWith(cleanBase)) {
    throw new Error(
      `URL does not match R2_PUBLIC_URL prefix: ${publicUrl}`,
    );
  }

  // Strip base URL + leading slash
  return publicUrl.substring(cleanBase.length + 1);
}
