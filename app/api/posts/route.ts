import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { creatorProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  createDraftPost,
  getPublishedPosts,
  getCreatorDrafts,
} from "@/lib/content/post-queries";

const createPostSchema = z.object({
  content: z.string().optional(),
});

const listPostsSchema = z.object({
  creatorProfileId: z.string().min(1),
  status: z.enum(["published", "draft"]).default("published"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function POST(req: Request) {
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

  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Look up creator profile
  const profile = await db.query.creatorProfile.findFirst({
    where: eq(creatorProfile.userId, session.user.id),
  });

  if (!profile) {
    return Response.json(
      { error: "Creator profile not found. Complete onboarding first." },
      { status: 403 },
    );
  }

  const newPost = await createDraftPost(profile.id, parsed.data.content);

  return Response.json({ post: newPost }, { status: 201 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams);

  const parsed = listPostsSchema.safeParse(params);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { creatorProfileId, status, limit, offset } = parsed.data;

  // If requesting drafts, verify ownership
  if (status === "draft") {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await db.query.creatorProfile.findFirst({
      where: eq(creatorProfile.userId, session.user.id),
    });

    if (!profile || profile.id !== creatorProfileId) {
      return Response.json(
        { error: "You can only view your own drafts" },
        { status: 403 },
      );
    }

    const drafts = await getCreatorDrafts(creatorProfileId);
    return Response.json({ posts: drafts, total: drafts.length });
  }

  // Published posts are public
  const result = await getPublishedPosts(creatorProfileId, limit, offset);
  return Response.json({ posts: result.posts, total: result.total });
}
