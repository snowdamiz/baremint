import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  generatePresignedUploadUrl,
  isAllowedContentType,
} from "@/lib/storage/upload";

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { fileName?: string; contentType?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { contentType } = body;

  if (!contentType || typeof contentType !== "string") {
    return Response.json(
      { error: "contentType is required" },
      { status: 400 },
    );
  }

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
