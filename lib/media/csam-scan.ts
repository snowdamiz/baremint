export type CSAMScanResult = {
  flagged: boolean;
  reason?: "hash_match" | "classifier";
  confidence?: number;
  rawResponse?: unknown;
};

/**
 * Scan media for CSAM using Hive Combined CSAM Detection API.
 *
 * POST to Hive sync endpoint with image URL. Checks both hash match
 * (known CSAM database) and AI classifier prediction.
 *
 * Throws if HIVE_CSAM_API_KEY is not configured or on API errors.
 * Never silently passes -- errors must be handled by the caller.
 */
export async function scanMediaForCSAM(
  mediaUrl: string,
): Promise<CSAMScanResult> {
  const apiKey = process.env.HIVE_CSAM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "HIVE_CSAM_API_KEY is not configured. CSAM scanning is required for all uploaded media.",
    );
  }

  const formData = new FormData();
  formData.append("url", mediaUrl);

  const response = await fetch("https://api.thehive.ai/api/v2/task/sync", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Hive CSAM API returned ${response.status}: ${errorText}`,
    );
  }

  const data = await response.json();

  // Check for hash match (known CSAM material)
  if (data?.output?.reasons) {
    for (const reason of data.output.reasons) {
      if (reason === "matched") {
        return {
          flagged: true,
          reason: "hash_match",
          rawResponse: data,
        };
      }
    }
  }

  // Check AI classifier prediction
  const classifierOutput =
    data?.output?.classifierPrediction?.csam_classifier;
  if (classifierOutput && classifierOutput.csam > 0.5) {
    return {
      flagged: true,
      reason: "classifier",
      confidence: classifierOutput.csam,
      rawResponse: data,
    };
  }

  return {
    flagged: false,
    rawResponse: data,
  };
}
