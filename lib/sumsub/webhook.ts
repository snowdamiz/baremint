import crypto from "node:crypto";

/**
 * Verify the HMAC-SHA256 signature of a Sumsub webhook payload.
 *
 * @param rawBody - Raw request body string
 * @param digestHeader - Value of the x-payload-digest header
 * @returns true if signature is valid
 */
export function verifySumsubWebhook(
  rawBody: string,
  digestHeader: string,
): boolean {
  const webhookSecret = process.env.SUMSUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("SUMSUB_WEBHOOK_SECRET is not configured");
    return false;
  }

  const computed = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  // Timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(digestHeader, "hex"),
    );
  } catch {
    // If digestHeader is not valid hex, comparison fails
    return false;
  }
}

interface SumsubEvent {
  applicantId: string;
  reviewStatus: "approved" | "rejected";
  rejectionReason?: string;
}

/**
 * Process a Sumsub webhook event payload.
 * Extracts applicant ID, review status, and optional rejection reason.
 *
 * @param payload - Parsed webhook JSON payload
 * @returns Processed event data
 */
export function processSumsubEvent(
  payload: Record<string, unknown>,
): SumsubEvent {
  const applicantId = payload.applicantId as string;
  if (!applicantId) {
    throw new Error("Missing applicantId in webhook payload");
  }

  const reviewResult = payload.reviewResult as
    | { reviewAnswer?: string; rejectLabels?: string[]; clientComment?: string }
    | undefined;

  let reviewStatus: "approved" | "rejected";
  let rejectionReason: string | undefined;

  if (reviewResult?.reviewAnswer === "GREEN") {
    reviewStatus = "approved";
  } else if (reviewResult?.reviewAnswer === "RED") {
    reviewStatus = "rejected";
    rejectionReason =
      reviewResult.clientComment ||
      reviewResult.rejectLabels?.join(", ") ||
      "Verification rejected";
  } else {
    // Default to rejected for unknown statuses to be safe
    reviewStatus = "rejected";
    rejectionReason = "Unknown review status";
  }

  return { applicantId, reviewStatus, rejectionReason };
}
