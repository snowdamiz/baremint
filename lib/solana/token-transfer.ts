/**
 * SPL token transfer builder for token tips (donations).
 *
 * Follows the same @solana/kit pipe pattern as transfer.ts and trade.ts.
 */

import {
  createSolanaRpc,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
} from "@solana/kit";
import type { Address } from "@solana/kit";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getTransferInstruction,
} from "@solana-program/token";
import { getUserWalletSigner } from "./transfer";

const DEVNET_RPC = "https://api.devnet.solana.com";
const TOKEN_PROGRAM: Address =
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address;

function getRpcUrl(): string {
  return process.env.HELIUS_RPC_URL || DEVNET_RPC;
}

/**
 * Build, sign, and send an SPL token transfer.
 *
 * Creates the recipient ATA idempotently (if it doesn't exist),
 * then transfers tokens from sender ATA to recipient ATA.
 *
 * @param userId - The user initiating the transfer (sender)
 * @param recipientAddress - Destination Solana wallet address (base58)
 * @param mintAddress - The SPL token mint address
 * @param amount - Raw token amount to transfer (BigInt)
 * @returns The transaction signature
 */
export async function buildAndSendTokenTransfer(
  userId: string,
  recipientAddress: string,
  mintAddress: string,
  amount: bigint,
): Promise<{ signature: string }> {
  const signer = await getUserWalletSigner(userId);

  const mint = mintAddress as Address;
  const recipient = recipientAddress as Address;

  // Derive ATAs for sender and recipient
  const [senderAta] = await findAssociatedTokenPda({
    mint,
    owner: signer.address,
    tokenProgram: TOKEN_PROGRAM,
  });

  const [recipientAta] = await findAssociatedTokenPda({
    mint,
    owner: recipient,
    tokenProgram: TOKEN_PROGRAM,
  });

  // Create recipient ATA idempotently (no-op if already exists)
  const createAtaIx =
    await getCreateAssociatedTokenIdempotentInstructionAsync({
      payer: signer,
      owner: recipient,
      mint,
      tokenProgram: TOKEN_PROGRAM,
    });

  // Transfer tokens from sender ATA to recipient ATA
  const transferIx = getTransferInstruction({
    source: senderAta,
    destination: recipientAta,
    authority: signer,
    amount,
  });

  // Build, sign, send
  const rpc = createSolanaRpc(getRpcUrl());
  const { value: latestBlockhash } = await rpc
    .getLatestBlockhash()
    .send();

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(signer.address, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstructions([createAtaIx, transferIx], m),
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
