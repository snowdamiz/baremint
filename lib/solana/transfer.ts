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
 * Create a signer from the user's encrypted wallet.
 * Shared helper used by both SOL transfer and token transfer modules.
 */
export async function getUserWalletSigner(userId: string) {
  const userWallet = await db.query.wallet.findFirst({
    where: eq(wallet.userId, userId),
  });

  if (!userWallet) {
    throw new Error("No wallet found for user");
  }

  const encryptionKey = getEncryptionKey();
  const privateKeyBytes = decryptPrivateKey(
    userWallet.encryptedPrivateKey,
    encryptionKey,
  );

  const addressEncoder = getAddressEncoder();
  const publicKeyBytes = addressEncoder.encode(
    userWallet.publicKey as Address,
  );

  const keypairBytes = new Uint8Array(64);
  keypairBytes.set(privateKeyBytes, 0);
  keypairBytes.set(publicKeyBytes, 32);

  const signer = await createKeyPairSignerFromBytes(keypairBytes);
  return signer;
}

/**
 * Pure SOL transfer: build, sign, and send without any DB side effects.
 *
 * @param userId - The user initiating the transfer
 * @param toAddress - Destination Solana address (base58)
 * @param amountLamports - Amount to transfer in lamports
 * @returns The transaction signature
 */
export async function sendSolTransfer(
  userId: string,
  toAddress: string,
  amountLamports: bigint,
): Promise<{ signature: string }> {
  const signer = await getUserWalletSigner(userId);

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

  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage);

  const base64EncodedTransaction =
    getBase64EncodedWireTransaction(signedTransaction);

  const txSignature = await rpc
    .sendTransaction(base64EncodedTransaction, {
      encoding: "base64",
    })
    .send();

  return { signature: txSignature };
}

/**
 * Build, sign, and send a SOL transfer transaction (with withdrawal record).
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
  const { signature: txSignature } = await sendSolTransfer(
    userId,
    toAddress,
    amountLamports,
  );

  // Record withdrawal in database
  const userWallet = await db.query.wallet.findFirst({
    where: eq(wallet.userId, userId),
  });

  const withdrawalId = crypto.randomUUID();
  await db.insert(withdrawal).values({
    id: withdrawalId,
    userId,
    fromAddress: userWallet!.publicKey,
    toAddress,
    amountLamports: amountLamports.toString(),
    txSignature,
    status: "confirmed",
    confirmedAt: new Date(),
  });

  return { signature: txSignature, withdrawalId };
}
