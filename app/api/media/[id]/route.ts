import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/media/[id]
 *
 * Returns the current status of a media record.
 * Used by the client to poll for video processing completion.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: mediaId } = await params;

  const [mediaRecord] = await db
    .select()
    .from(media)
    .where(eq(media.id, mediaId))
    .limit(1);

  if (!mediaRecord) {
    return Response.json({ error: "Media not found" }, { status: 404 });
  }

  return Response.json({
    id: mediaRecord.id,
    type: mediaRecord.type,
    status: mediaRecord.status,
    variants: mediaRecord.variants,
    muxPlaybackId: mediaRecord.muxPlaybackId,
    muxAssetId: mediaRecord.muxAssetId,
    width: mediaRecord.width,
    height: mediaRecord.height,
    duration: mediaRecord.duration,
  });
}
