import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { notification } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { z } from "zod";

const LIMIT = 50;

export async function GET(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);

  const notifications = await db
    .select()
    .from(notification)
    .where(eq(notification.userId, session.user.id))
    .orderBy(desc(notification.createdAt))
    .limit(LIMIT + 1)
    .offset(offset);

  const hasMore = notifications.length > LIMIT;
  if (hasMore) notifications.pop();

  return Response.json({ notifications, hasMore });
}

const patchSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
});

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await db
    .update(notification)
    .set({ isRead: true })
    .where(
      and(
        eq(notification.userId, session.user.id),
        inArray(notification.id, body.ids),
      ),
    );

  return Response.json({ updated: body.ids.length });
}
