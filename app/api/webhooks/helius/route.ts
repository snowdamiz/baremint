import { db } from "@/lib/db";
import { trade } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notifyTokenHolders } from "@/lib/notifications/create";

/**
 * POST /api/webhooks/helius
 *
 * Handles Helius webhook notifications for trade transaction confirmations.
 * Raw webhooks send an array of transaction objects in the POST body.
 *
 * Always returns 200 to prevent retry storms (same pattern as Mux webhook).
 * Idempotent: WHERE status='pending' ensures duplicate deliveries are safe.
 */
export async function POST(req: Request) {
  // Optional: Verify webhook authenticity via Authorization header
  const webhookSecret = process.env.HELIUS_WEBHOOK_SECRET;
  if (webhookSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== webhookSecret) {
      console.warn(
        "Helius webhook: Authorization header mismatch (expected HELIUS_WEBHOOK_SECRET)"
      );
      // Still return 200 to prevent retry storms — log for investigation
      return new Response("OK", { status: 200 });
    }
  }

  let transactions: unknown[];
  try {
    const body = await req.json();
    // Helius raw webhooks send a JSON array of transactions
    if (!Array.isArray(body)) {
      console.warn("Helius webhook: body is not an array, skipping");
      return new Response("OK", { status: 200 });
    }
    transactions = body;
  } catch (error) {
    console.error("Helius webhook: failed to parse request body:", error);
    return new Response("OK", { status: 200 });
  }

  try {
    for (const tx of transactions) {
      await processTransaction(tx);
    }
  } catch (error) {
    // Log the error but return 200 to prevent retry storms
    console.error("Helius webhook processing error:", error);
  }

  return new Response("OK", { status: 200 });
}

/**
 * Process a single transaction from the Helius webhook payload.
 *
 * Handles both raw and enhanced webhook formats defensively:
 * - Raw: tx.transaction.signatures[0]
 * - Enhanced: tx.signature
 */
async function processTransaction(tx: unknown): Promise<void> {
  if (!tx || typeof tx !== "object") return;

  const txObj = tx as Record<string, unknown>;

  // Extract signature — handle both raw and enhanced formats
  let signature: string | undefined;

  // Raw format: tx.transaction.signatures[0]
  const txInner = txObj.transaction as Record<string, unknown> | undefined;
  if (txInner && Array.isArray(txInner.signatures) && txInner.signatures[0]) {
    signature = String(txInner.signatures[0]);
  }

  // Enhanced format fallback: tx.signature
  if (!signature && typeof txObj.signature === "string") {
    signature = txObj.signature;
  }

  if (!signature) {
    console.warn("Helius webhook: transaction missing signature, skipping");
    return;
  }

  // Look up pending trade by txSignature
  const [pendingTrade] = await db
    .select({ id: trade.id })
    .from(trade)
    .where(and(eq(trade.txSignature, signature), eq(trade.status, "pending")))
    .limit(1);

  if (!pendingTrade) {
    // Not a trade we're tracking, or already processed — skip silently
    return;
  }

  // Determine transaction success/failure from meta.err
  // meta.err === null means success, non-null means failure
  const meta = txObj.meta as Record<string, unknown> | undefined;
  const isSuccess = meta ? meta.err === null || meta.err === undefined : true;
  const status = isSuccess ? "confirmed" : "failed";

  // Update trade — WHERE status='pending' provides idempotency
  await db
    .update(trade)
    .set({
      status,
      confirmedAt: new Date(),
    })
    .where(and(eq(trade.txSignature, signature), eq(trade.status, "pending")));

  // Fan out notifications to token holders (non-fatal)
  if (status === "confirmed") {
    try {
      const [confirmedTrade] = await db
        .select({
          userId: trade.userId,
          mintAddress: trade.mintAddress,
          type: trade.type,
          solAmount: trade.solAmount,
          txSignature: trade.txSignature,
        })
        .from(trade)
        .where(eq(trade.id, pendingTrade.id))
        .limit(1);

      if (confirmedTrade) {
        await notifyTokenHolders(
          confirmedTrade.mintAddress,
          confirmedTrade.type === "buy" ? "trade_buy" : "trade_sell",
          confirmedTrade.userId,
          confirmedTrade.type === "buy" ? "New token purchase" : "Token sold",
          `Someone ${confirmedTrade.type === "buy" ? "bought" : "sold"} tokens`,
          confirmedTrade.txSignature,
        );
      }
    } catch (err) {
      console.error("Notification fan-out error:", err);
    }
  }
}
