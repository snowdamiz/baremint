import crypto from "node:crypto";

const SUMSUB_BASE_URL = "https://api.sumsub.com";

/**
 * Generate HMAC-SHA256 signature for Sumsub API requests.
 * Format: HMAC-SHA256(timestamp + method + path + body)
 */
function createSignature(
  method: string,
  path: string,
  body: string,
  ts: number,
): string {
  const secretKey = process.env.SUMSUB_SECRET_KEY;
  if (!secretKey) {
    throw new Error("SUMSUB_SECRET_KEY is not configured");
  }

  const data = ts.toString() + method.toUpperCase() + path + body;
  return crypto
    .createHmac("sha256", secretKey)
    .update(data)
    .digest("hex");
}

/**
 * Generate a Sumsub access token for the WebSDK.
 *
 * @param userId - External user ID (our user ID)
 * @param levelName - Sumsub verification level name
 * @returns Access token and user ID for WebSDK initialization
 */
export async function generateSumsubAccessToken(
  userId: string,
  levelName: string = "basic-kyc-level",
): Promise<{ token: string; userId: string }> {
  const appToken = process.env.SUMSUB_APP_TOKEN;
  if (!appToken) {
    throw new Error("SUMSUB_APP_TOKEN is not configured");
  }

  const ts = Math.floor(Date.now() / 1000);
  const path = `/resources/accessTokens?userId=${encodeURIComponent(userId)}&levelName=${encodeURIComponent(levelName)}`;
  const body = "";

  const signature = createSignature("POST", path, body, ts);

  const response = await fetch(`${SUMSUB_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "X-App-Token": appToken,
      "X-App-Access-Ts": ts.toString(),
      "X-App-Access-Sig": signature,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sumsub token generation failed:", response.status, errorText);
    throw new Error(`Sumsub API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    token: data.token,
    userId,
  };
}
