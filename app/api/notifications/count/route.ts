import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { notification } from "@/lib/db/schema";
import { eq, and, sql, count } from "drizzle-orm";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [result] = await db
    .select({ count: count() })
    .from(notification)
    .where(
      and(
        eq(notification.userId, session.user.id),
        eq(notification.isRead, false),
      ),
    );

  return Response.json({ count: result?.count ?? 0 });
}
