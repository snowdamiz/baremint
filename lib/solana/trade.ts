/**
 * Buy and sell transaction builders for the bonding curve program.
 *
 * Follows the same @solana/kit pipe pattern as create-token.ts and transfer.ts.
 */

import {
  createSolanaRpc,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  createKeyPairSignerFromBytes,
  getBase64EncodedWireTransaction,
  getAddressEncoder,
  getU64Encoder,
  getProgramDerivedAddress,
  AccountRole,
  address,
} from "@solana/kit";
import type { Address, Instruction } from "@solana/kit";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
} from "@solana-program/token";
import { db } from "@/lib/db";
import { wallet } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decryptPrivateKey, getEncryptionKey } from "./keypair";
import { estimateBuy, estimateSell } from "./bonding-curve-math";
import {
  readBondingCurveAccount,
  readGlobalConfig,
} from "./bonding-curve-read";

const DEVNET_RPC = "https://api.devnet.solana.com";
const PROGRAM_ID: Address =
  "FTAssMPiQ8EQUeJA4Rnu6c71maCrUCdnvGetWnVdTXTG" as Address;
const TOKEN_PROGRAM: Address =
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address;
const SYSTEM_PROGRAM: Address =
  "11111111111111111111111111111111" as Address;

// Anchor IDL discriminators
const BUY_DISCRIMINATOR = new Uint8Array([102, 6, 61, 18, 1, 218, 235, 234]);
const SELL_DISCRIMINATOR = new Uint8Array([51, 230, 133, 164, 1, 127, 131, 173]);

function getRpcUrl(): string {
  return process.env.HELIUS_RPC_URL || DEVNET_RPC;
}

/**
 * Create a signer from the user's encrypted wallet.
 */
async function getUserSigner(userId: string) {
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
 * Derive PDAs needed for buy/sell instructions.
 */
async function deriveTradePDAs(mintAddr: Address) {
  const addressEncoder = getAddressEncoder();
  const mintBytes = addressEncoder.encode(mintAddr);

  const [globalConfig] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["global_config"],
  });

  const [bondingCurve] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["bonding_curve", mintBytes],
  });

  const [curveTokenAccount] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["curve_tokens", mintBytes],
  });

  return { globalConfig, bondingCurve, curveTokenAccount };
}

/**
 * Build instruction data: [8-byte discriminator][u64 arg1][u64 arg2]
 */
function buildInstructionData(
  discriminator: Uint8Array,
  arg1: bigint,
  arg2: bigint,
): Uint8Array {
  const u64Encoder = getU64Encoder();
  const arg1Bytes = u64Encoder.encode(arg1);
  const arg2Bytes = u64Encoder.encode(arg2);

  const data = new Uint8Array(8 + 8 + 8);
  data.set(discriminator, 0);
  data.set(new Uint8Array(arg1Bytes), 8);
  data.set(new Uint8Array(arg2Bytes), 16);
  return data;
}

/**
 * Build, sign, and send a buy transaction on the bonding curve.
 *
 * 1. Creates buyer ATA idempotently
 * 2. Builds buy instruction with slippage protection
 * 3. Signs and sends in a single transaction
 */
export async function buildAndSendBuy(
  userId: string,
  mintAddress: string,
  solAmount: bigint,
  slippageBps: number,
): Promise<{
  signature: string;
  estimate: {
    tokensOut: bigint;
    totalFee: bigint;
    platformFee: bigint;
    creatorFee: bigint;
    solIntoCurve: bigint;
  };
}> {
  // 1. Get user signer
  const signer = await getUserSigner(userId);

  // 2. Read on-chain state
  const bondingCurve = await readBondingCurveAccount(mintAddress);
  const globalConfig = await readGlobalConfig();

  // 3. Calculate estimate
  const estimate = estimateBuy(
    solAmount,
    globalConfig.feeBps,
    bondingCurve.virtualSolReserves,
    bondingCurve.virtualTokenReserves,
  );

  // 4. Slippage protection
  const minTokensOut =
    estimate.tokensOut -
    (estimate.tokensOut * BigInt(slippageBps)) / BigInt(10000);

  // 5. Derive PDAs
  const mintAddr = address(mintAddress);
  const pdas = await deriveTradePDAs(mintAddr);

  // 6. Derive buyer ATA
  const [buyerAta] = await findAssociatedTokenPda({
    owner: signer.address,
    tokenProgram: TOKEN_PROGRAM,
    mint: mintAddr,
  });

  // 7. Build create-ATA-idempotent instruction
  const createAtaIx =
    await getCreateAssociatedTokenIdempotentInstructionAsync({
      payer: signer,
      owner: signer.address,
      mint: mintAddr,
    });

  // 8. Build buy instruction
  const buyData = buildInstructionData(
    BUY_DISCRIMINATOR,
    solAmount,
    minTokensOut,
  );

  const buyInstruction: Instruction = {
    programAddress: PROGRAM_ID,
    accounts: [
      // buyer (signer, mut)
      { address: signer.address, role: AccountRole.WRITABLE_SIGNER },
      // global_config (readonly)
      { address: pdas.globalConfig, role: AccountRole.READONLY },
      // bonding_curve (mut)
      { address: pdas.bondingCurve, role: AccountRole.WRITABLE },
      // token_mint (readonly)
      { address: mintAddr, role: AccountRole.READONLY },
      // curve_token_account (mut)
      { address: pdas.curveTokenAccount, role: AccountRole.WRITABLE },
      // buyer_token_account (mut)
      { address: buyerAta, role: AccountRole.WRITABLE },
      // token_program (readonly)
      { address: TOKEN_PROGRAM, role: AccountRole.READONLY },
      // system_program (readonly)
      { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
    ],
    data: buyData,
  };

  // 9. Build transaction message
  const rpc = createSolanaRpc(getRpcUrl());
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(signer.address, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstructions([createAtaIx, buyInstruction], m),
  );

  // 10. Sign and send
  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage);
  const base64Tx = getBase64EncodedWireTransaction(signedTransaction);

  const txSignature = await rpc
    .sendTransaction(base64Tx, { encoding: "base64" })
    .send();

  return { signature: txSignature, estimate };
}

/**
 * Build, sign, and send a sell transaction on the bonding curve.
 *
 * Builds sell instruction with slippage protection.
 * Seller must already have tokens in their ATA.
 */
export async function buildAndSendSell(
  userId: string,
  mintAddress: string,
  tokenAmount: bigint,
  slippageBps: number,
): Promise<{
  signature: string;
  estimate: {
    netSol: bigint;
    grossSol: bigint;
    totalFee: bigint;
    platformFee: bigint;
    creatorFee: bigint;
  };
}> {
  // 1. Get user signer
  const signer = await getUserSigner(userId);

  // 2. Read on-chain state
  const bondingCurve = await readBondingCurveAccount(mintAddress);
  const globalConfig = await readGlobalConfig();

  // 3. Calculate estimate
  const estimate = estimateSell(
    tokenAmount,
    globalConfig.feeBps,
    bondingCurve.virtualSolReserves,
    bondingCurve.virtualTokenReserves,
  );

  // 4. Slippage protection
  const minSolOut =
    estimate.netSol -
    (estimate.netSol * BigInt(slippageBps)) / BigInt(10000);

  // 5. Derive PDAs
  const mintAddr = address(mintAddress);
  const pdas = await deriveTradePDAs(mintAddr);

  // 6. Derive seller ATA
  const [sellerAta] = await findAssociatedTokenPda({
    owner: signer.address,
    tokenProgram: TOKEN_PROGRAM,
    mint: mintAddr,
  });

  // 7. Build sell instruction
  const sellData = buildInstructionData(
    SELL_DISCRIMINATOR,
    tokenAmount,
    minSolOut,
  );

  const sellInstruction: Instruction = {
    programAddress: PROGRAM_ID,
    accounts: [
      // seller (signer, mut)
      { address: signer.address, role: AccountRole.WRITABLE_SIGNER },
      // global_config (readonly)
      { address: pdas.globalConfig, role: AccountRole.READONLY },
      // bonding_curve (mut)
      { address: pdas.bondingCurve, role: AccountRole.WRITABLE },
      // token_mint (readonly)
      { address: mintAddr, role: AccountRole.READONLY },
      // curve_token_account (mut)
      { address: pdas.curveTokenAccount, role: AccountRole.WRITABLE },
      // seller_token_account (mut)
      { address: sellerAta, role: AccountRole.WRITABLE },
      // token_program (readonly)
      { address: TOKEN_PROGRAM, role: AccountRole.READONLY },
      // system_program (readonly)
      { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
    ],
    data: sellData,
  };

  // 8. Build transaction message
  const rpc = createSolanaRpc(getRpcUrl());
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(signer.address, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstructions([sellInstruction], m),
  );

  // 9. Sign and send
  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage);
  const base64Tx = getBase64EncodedWireTransaction(signedTransaction);

  const txSignature = await rpc
    .sendTransaction(base64Tx, { encoding: "base64" })
    .send();

  return { signature: txSignature, estimate };
}
