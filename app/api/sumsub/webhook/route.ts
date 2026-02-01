import { db } from "@/lib/db";
import { creatorProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifySumsubWebhook, processSumsubEvent } from "@/lib/sumsub/webhook";

export async function POST(req: Request) {
  // Read raw body for signature verification
  const rawBody = await req.text();

  // Verify webhook signature
  const digestHeader = req.headers.get("x-payload-digest");
  if (!digestHeader) {
    return Response.json(
      { error: "Missing signature header" },
      { status: 401 },
    );
  }

  if (!verifySumsubWebhook(rawBody, digestHeader)) {
    console.error("Sumsub webhook signature verification failed");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Parse and process the event
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only process applicantReviewed events
  const eventType = payload.type as string;
  if (eventType !== "applicantReviewed") {
    // Acknowledge non-review events without processing
    return Response.json({ ok: true });
  }

  try {
    const event = processSumsubEvent(payload);

    // Find creator profile by kycApplicantId
    const profile = await db.query.creatorProfile.findFirst({
      where: eq(creatorProfile.kycApplicantId, event.applicantId),
    });

    if (!profile) {
      console.error(
        "No creator profile found for applicant:",
        event.applicantId,
      );
      // Return 200 anyway to prevent Sumsub from retrying
      return Response.json({ ok: true });
    }

    // Update KYC status
    await db
      .update(creatorProfile)
      .set({
        kycStatus: event.reviewStatus,
        kycRejectionReason: event.rejectionReason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(creatorProfile.id, profile.id));

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Failed to process Sumsub webhook:", error);
    // Return 200 to prevent infinite retries on processing errors
    return Response.json({ ok: true });
  }
}
