import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { creatorProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
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
      { status: "none", rejectionReason: null },
    );
  }

  return Response.json({
    status: profile.kycStatus,
    rejectionReason: profile.kycRejectionReason ?? null,
  });
}
