import sharp from "sharp";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "@/lib/storage/upload";

const RESPONSIVE_SIZES = {
  sm: 400,
  md: 800,
  lg: 1200,
} as const;

const WEBP_QUALITY = 80;

/**
 * Download a file from R2 by its key.
 */
export async function downloadFromR2(key: string): Promise<Buffer> {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    throw new Error("R2_BUCKET is not configured.");
  }

  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await client.send(command);
  if (!response.Body) {
    throw new Error(`Empty response body for key: ${key}`);
  }

  // Convert readable stream to Buffer
  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Upload a buffer to R2 with the given key and content type.
 */
export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    throw new Error("R2_BUCKET is not configured.");
  }

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);
}

/**
 * Process an uploaded image into responsive WebP variants.
 *
 * Takes the original image buffer and a base R2 key (e.g. content/xyz/abc/original.jpg).
 * Generates 3 sizes (400px, 800px, 1200px) as WebP at quality 80.
 * Uploads each variant to R2 and returns a map of size -> public URL.
 *
 * Small images are NOT upscaled (withoutEnlargement: true).
 * Original is preserved -- not deleted or overwritten.
 *
 * @returns Map of variant sizes to public URLs, plus width/height of the largest variant
 */
export async function processUploadedImage(
  imageBuffer: Buffer,
  baseKey: string,
): Promise<{
  variants: Record<string, string>;
  width: number;
  height: number;
}> {
  const publicUrlBase = process.env.R2_PUBLIC_URL;
  if (!publicUrlBase) {
    throw new Error("R2_PUBLIC_URL is not configured.");
  }

  const cleanPublicUrl = publicUrlBase.replace(/\/$/, "");

  // Get original image metadata for returning dimensions
  const metadata = await sharp(imageBuffer).metadata();
  const originalWidth = metadata.width ?? 0;
  const originalHeight = metadata.height ?? 0;

  // Derive variant key from base key: replace the filename with {size}.webp
  // e.g. content/xyz/abc/original.jpg -> content/xyz/abc/sm.webp
  const keyDir = baseKey.substring(0, baseKey.lastIndexOf("/") + 1);

  const variants: Record<string, string> = {};

  for (const [suffix, width] of Object.entries(RESPONSIVE_SIZES)) {
    const variantKey = `${keyDir}${suffix}.webp`;

    const variantBuffer = await sharp(imageBuffer)
      .resize(width, undefined, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    await uploadToR2(variantKey, variantBuffer, "image/webp");

    variants[suffix] = `${cleanPublicUrl}/${variantKey}`;
  }

  // Generate blur variant for content gating placeholders
  // Always generated since access level is set at publish time, not upload time.
  // The blur URL is safe to be public (heavily blurred, no detail visible).
  const blurKey = `${keyDir}blur.webp`;
  const blurBuffer = await sharp(imageBuffer)
    .resize(40, undefined, { fit: "inside", withoutEnlargement: true })
    .blur(20)
    .resize(400, undefined, {
      fit: "inside",
      withoutEnlargement: true,
      kernel: "cubic",
    })
    .webp({ quality: 60 })
    .toBuffer();
  await uploadToR2(blurKey, blurBuffer, "image/webp");
  variants["blur"] = `${cleanPublicUrl}/${blurKey}`;

  return {
    variants,
    width: originalWidth,
    height: originalHeight,
  };
}
