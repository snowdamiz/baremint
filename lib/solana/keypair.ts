import crypto from "node:crypto";
import { getBase58Decoder } from "@solana/kit";

/**
 * Generate a Solana-compatible Ed25519 keypair.
 *
 * Uses Node.js crypto (not Web Crypto) so the raw key bytes are extractable.
 * Returns the base58 public address and raw 32-byte private key.
 */
export function generateWalletKeypair(): {
  publicKey: string;
  privateKeyBytes: Uint8Array;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

  // Export DER-encoded keys and extract the raw 32-byte values
  const publicKeyDer = publicKey.export({ type: "spki", format: "der" });
  const privateKeyDer = privateKey.export({ type: "pkcs8", format: "der" });

  // SPKI for Ed25519: last 32 bytes are the raw public key
  const publicKeyBytes = publicKeyDer.subarray(publicKeyDer.length - 32);
  // PKCS8 for Ed25519: last 32 bytes are the raw private key
  const privateKeyBytes = privateKeyDer.subarray(privateKeyDer.length - 32);

  // Decode public key bytes to base58 Solana address string
  const base58Decoder = getBase58Decoder();
  const address = base58Decoder.decode(publicKeyBytes);

  return {
    publicKey: address,
    privateKeyBytes: new Uint8Array(privateKeyBytes),
  };
}

// ---------------------------------------------------------------------------
// AES-256-GCM encryption for private key storage
// ---------------------------------------------------------------------------

/**
 * Encrypt private key bytes with AES-256-GCM.
 * Returns a colon-separated string: "iv:authTag:ciphertext" (all base64).
 */
export function encryptPrivateKey(
  privateKeyBytes: Uint8Array,
  encryptionKey: Buffer,
): string {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);

  const encrypted = Buffer.concat([
    cipher.update(privateKeyBytes),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypt an encrypted private key string back to raw bytes.
 * Input format: "iv:authTag:ciphertext" (all base64).
 */
export function decryptPrivateKey(
  encryptedString: string,
  encryptionKey: Buffer,
): Uint8Array {
  const [ivB64, authTagB64, encryptedB64] = encryptedString.split(":");
  if (!ivB64 || !authTagB64 || !encryptedB64) {
    throw new Error("Invalid encrypted private key format");
  }

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return new Uint8Array(decrypted);
}

// ---------------------------------------------------------------------------
// Encryption key management
// ---------------------------------------------------------------------------

/**
 * Load the 32-byte AES-256 encryption key from the environment.
 * Expects WALLET_ENCRYPTION_KEY as a 64-character hex string.
 */
export function getEncryptionKey(): Buffer {
  const hexKey = process.env.WALLET_ENCRYPTION_KEY;
  if (!hexKey) {
    throw new Error(
      "WALLET_ENCRYPTION_KEY environment variable is not set. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  if (hexKey.length !== 64) {
    throw new Error(
      `WALLET_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Got ${hexKey.length} characters.`,
    );
  }
  return Buffer.from(hexKey, "hex");
}
