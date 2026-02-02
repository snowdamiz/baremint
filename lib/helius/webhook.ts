import { createHelius } from "helius-sdk";

/**
 * Register a Helius webhook to monitor a bonding curve PDA for trade transactions.
 *
 * Uses raw webhook type for lower latency. The webhook handler at
 * /api/webhooks/helius processes incoming notifications.
 *
 * Gracefully handles missing HELIUS_API_KEY — returns null without throwing
 * so webhook setup never blocks trade execution.
 *
 * @param bondingCurveAddress - The bonding curve PDA address to monitor
 * @returns The webhook ID on success, or null on failure
 */
export async function registerTradeWebhook(
  bondingCurveAddress: string
): Promise<string | null> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    console.warn(
      "registerTradeWebhook: HELIUS_API_KEY not set, skipping webhook registration"
    );
    return null;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.warn(
      "registerTradeWebhook: NEXT_PUBLIC_APP_URL not set, skipping webhook registration"
    );
    return null;
  }

  try {
    const helius = createHelius({ apiKey });
    const webhookURL = `${appUrl.replace(/\/$/, "")}/api/webhooks/helius`;

    const webhook = await helius.webhooks.create({
      webhookURL,
      transactionTypes: ["ANY"],
      accountAddresses: [bondingCurveAddress],
      webhookType: "raw",
      // Pass auth header if secret is configured
      ...(process.env.HELIUS_WEBHOOK_SECRET
        ? { authHeader: process.env.HELIUS_WEBHOOK_SECRET }
        : {}),
    });

    return webhook.webhookID;
  } catch (error) {
    console.error(
      `registerTradeWebhook: failed for address ${bondingCurveAddress}:`,
      error
    );
    return null;
  }
}

/**
 * Delete a previously registered Helius webhook.
 *
 * @param webhookId - The webhook ID to delete
 * @returns true if deleted, false on error
 */
export async function deleteTradeWebhook(
  webhookId: string
): Promise<boolean> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    console.warn(
      "deleteTradeWebhook: HELIUS_API_KEY not set, cannot delete webhook"
    );
    return false;
  }

  try {
    const helius = createHelius({ apiKey });
    return await helius.webhooks.delete(webhookId);
  } catch (error) {
    console.error(
      `deleteTradeWebhook: failed for webhook ${webhookId}:`,
      error
    );
    return false;
  }
}
