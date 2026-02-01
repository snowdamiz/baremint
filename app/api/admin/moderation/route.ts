import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getModerQueue } from "@/lib/content/moderation";

function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS ?? "";
  const list = adminEmails.split(",").map((e) => e.trim().toLowerCase());
  return list.includes(email.toLowerCase());
}

export async function GET(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdmin(session.user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10), 1),
    100,
  );
  const offset = Math.max(
    parseInt(url.searchParams.get("offset") ?? "0", 10),
    0,
  );

  const result = await getModerQueue(limit, offset);

  return Response.json(result);
}
