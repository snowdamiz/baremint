import Mux from "@mux/mux-node";

let _mux: Mux | null = null;

/**
 * Get a lazy singleton Mux client.
 *
 * Reads MUX_TOKEN_ID, MUX_TOKEN_SECRET, and MUX_WEBHOOK_SECRET from env.
 * Uses the same lazy-init pattern as the DB connection to allow builds
 * without environment variables present.
 */
export function getMuxClient(): Mux {
  if (!_mux) {
    const tokenId = process.env.MUX_TOKEN_ID;
    const tokenSecret = process.env.MUX_TOKEN_SECRET;

    if (!tokenId || !tokenSecret) {
      throw new Error(
        "Mux not configured. Set MUX_TOKEN_ID and MUX_TOKEN_SECRET.",
      );
    }

    _mux = new Mux({
      tokenId,
      tokenSecret,
      webhookSecret: process.env.MUX_WEBHOOK_SECRET ?? null,
    });
  }

  return _mux;
}
