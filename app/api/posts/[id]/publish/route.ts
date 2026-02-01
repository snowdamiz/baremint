import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { creatorProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { publishPost } from "@/lib/content/post-queries";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.query.creatorProfile.findFirst({
    where: eq(creatorProfile.userId, session.user.id),
  });

  if (!profile) {
    return Response.json(
      { error: "Creator profile not found" },
      { status: 403 },
    );
  }

  const published = await publishPost(id, profile.id);
  if (!published) {
    return Response.json(
      { error: "Post not found or not a draft" },
      { status: 404 },
    );
  }

  return Response.json({ post: published });
}
