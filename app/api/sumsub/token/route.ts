import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { creatorProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateSumsubAccessToken } from "@/lib/sumsub/token";

export async function POST() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Look up creator profile
  const profile = await db.query.creatorProfile.findFirst({
    where: eq(creatorProfile.userId, session.user.id),
  });

  if (!profile) {
    return Response.json(
      { error: "Creator profile not found. Complete the profile step first." },
      { status: 400 },
    );
  }

  try {
    const { token } = await generateSumsubAccessToken(session.user.id);

    // Store the applicant mapping if not already set
    if (!profile.kycApplicantId) {
      await db
        .update(creatorProfile)
        .set({
          kycApplicantId: session.user.id,
          kycStatus: "pending",
          updatedAt: new Date(),
        })
        .where(eq(creatorProfile.id, profile.id));
    }

    return Response.json({ token });
  } catch (error) {
    console.error("Failed to generate Sumsub token:", error);
    return Response.json(
      { error: "Failed to initialize verification. Please try again." },
      { status: 500 },
    );
  }
}
