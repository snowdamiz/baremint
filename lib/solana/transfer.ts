import crypto from "node:crypto";
import {
  createSolanaRpc,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  signTransactionMessageWithSigners,
  createKeyPairSignerFromBytes,
  getBase64EncodedWireTransaction,
  getAddressEncoder,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import type { Address } from "@solana/kit";
import { db } from "@/lib/db";
import { wallet, withdrawal } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decryptPrivateKey, getEncryptionKey } from "./keypair";

const DEVNET_RPC = "https://api.devnet.solana.com";

function getRpcUrl(): string {
  return process.env.HELIUS_RPC_URL || DEVNET_RPC;
}

/**
 * Build, sign, and send a SOL transfer transaction.
 *
 * @param userId - The user initiating the transfer
 * @param toAddress - Destination Solana address (base58)
 * @param amountLamports - Amount to transfer in lamports
 * @returns The transaction signature and withdrawal record ID
 */
export async function buildAndSendSolTransfer(
  userId: string,
  toAddress: string,
  amountLamports: bigint,
): Promise<{ signature: string; withdrawalId: string }> {
  // 1. Get user wallet
  const userWallet = await db.query.wallet.findFirst({
    where: eq(wallet.userId, userId),
  });

  if (!userWallet) {
    throw new Error("No wallet found for user");
  }

  // 2. Decrypt private key and create signer
  const encryptionKey = getEncryptionKey();
  const privateKeyBytes = decryptPrivateKey(
    userWallet.encryptedPrivateKey,
    encryptionKey,
  );

  // Encode public key address to 32 bytes
  const addressEncoder = getAddressEncoder();
  const publicKeyBytes = addressEncoder.encode(userWallet.publicKey as Address);

  // Concatenate private key (32 bytes) + public key (32 bytes) for the full keypair
  const keypairBytes = new Uint8Array(64);
  keypairBytes.set(privateKeyBytes, 0);
  keypairBytes.set(publicKeyBytes, 32);

  const signer = await createKeyPairSignerFromBytes(keypairBytes);

  // 3. Build transaction
  const rpc = createSolanaRpc(getRpcUrl());
  const { value: latestBlockhash } = await rpc
    .getLatestBlockhash()
    .send();

  const transferInstruction = getTransferSolInstruction({
    source: signer,
    destination: toAddress as Address,
    amount: amountLamports,
  });

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(signer.address, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstruction(transferInstruction, m),
  );

  // 4. Sign and send
  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage);

  const base64EncodedTransaction =
    getBase64EncodedWireTransaction(signedTransaction);

  const txSignature = await rpc
    .sendTransaction(base64EncodedTransaction, {
      encoding: "base64",
    })
    .send();

  // 5. Record withdrawal in database
  const withdrawalId = crypto.randomUUID();
  await db.insert(withdrawal).values({
    id: withdrawalId,
    userId,
    fromAddress: userWallet.publicKey,
    toAddress,
    amountLamports: amountLamports.toString(),
    txSignature,
    status: "confirmed",
    confirmedAt: new Date(),
  });

  return { signature: txSignature, withdrawalId };
}
