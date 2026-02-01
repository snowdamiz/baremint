import Mux from "@mux/mux-node";

let _mux: Mux | null = null;

/**
 * Get a lazy singleton Mux client.
 *
 * Reads MUX_TOKEN_ID, MUX_TOKEN_SECRET, and MUX_WEBHOOK_SECRET from env.
 * Optionally reads MUX_SIGNING_KEY_ID and MUX_PRIVATE_KEY for JWT signing
 * (required for signed playback of gated video content).
 *
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

    // JWT signing config for gated video playback tokens
    // MUX_PRIVATE_KEY should be base64-encoded RSA private key
    const signingKeyId = process.env.MUX_SIGNING_KEY_ID;
    const privateKeyBase64 = process.env.MUX_PRIVATE_KEY;
    const jwtConfig =
      signingKeyId && privateKeyBase64
        ? {
            jwtSigningKey: signingKeyId,
            jwtPrivateKey: Buffer.from(
              privateKeyBase64,
              "base64",
            ).toString("ascii"),
          }
        : {};

    _mux = new Mux({
      tokenId,
      tokenSecret,
      webhookSecret: process.env.MUX_WEBHOOK_SECRET ?? null,
      ...jwtConfig,
    });
  }

  return _mux;
}
