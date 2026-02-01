import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { creatorProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  getPostById,
  updateDraftPost,
  deletePost,
} from "@/lib/content/post-queries";

const updatePostSchema = z.object({
  content: z.string(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const postData = await getPostById(id);
  if (!postData) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  // Published posts are visible to all
  if (postData.status === "published") {
    return Response.json({ post: postData });
  }

  // Draft/processing/under_review posts visible only to owner
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  const profile = await db.query.creatorProfile.findFirst({
    where: eq(creatorProfile.userId, session.user.id),
  });

  if (!profile || profile.id !== postData.creatorProfileId) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  return Response.json({ post: postData });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updatePostSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
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

  const updated = await updateDraftPost(id, profile.id, parsed.data.content);
  if (!updated) {
    return Response.json(
      { error: "Post not found or not a draft" },
      { status: 404 },
    );
  }

  return Response.json({ post: updated });
}

export async function DELETE(
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

  const deleted = await deletePost(id, profile.id);
  if (!deleted) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  return Response.json({ post: deleted });
}
