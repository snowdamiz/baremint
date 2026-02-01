import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";
import { approveContent, rejectContent } from "@/lib/content/moderation";

function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS ?? "";
  const list = adminEmails.split(",").map((e) => e.trim().toLowerCase());
  return list.includes(email.toLowerCase());
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().min(1, "Reason is required for rejections"),
  }),
]);

export async function POST(
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

  if (!isAdmin(session.user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.action === "approve") {
    const result = await approveContent(id, session.user.id);
    if (!result) {
      return Response.json(
        { error: "Moderation action not found" },
        { status: 404 },
      );
    }
    return Response.json({ moderationAction: result });
  }

  // reject
  const result = await rejectContent(id, session.user.id, parsed.data.reason);
  if (!result) {
    return Response.json(
      { error: "Moderation action not found" },
      { status: 404 },
    );
  }
  return Response.json(result);
}
