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
import {
  estimateBuy,
  estimateSell,
  calculateTokensForSolValue,
} from "./bonding-curve-math";
import {
  readBondingCurveAccount,
  readGlobalConfig,
} from "./bonding-curve-read";
import {
  readVestingAccount,
  calculateClaimable,
} from "./vesting-read";

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
const BURN_FOR_ACCESS_DISCRIMINATOR = new Uint8Array([77, 60, 201, 5, 156, 231, 61, 29]);
// sha256("global:withdraw_creator_fees") first 8 bytes
const WITHDRAW_CREATOR_FEES_DISCRIMINATOR = new Uint8Array([8, 30, 213, 18, 121, 105, 129, 222]);
// sha256("global:claim_vested") first 8 bytes
const CLAIM_VESTED_DISCRIMINATOR = new Uint8Array([208, 190, 166, 114, 203, 225, 140, 208]);

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

/**
 * Build, sign, and send a burn-for-access transaction on the bonding curve.
 *
 * Burns tokens from the viewer's account based on the on-chain burn_sol_price.
 * This is a deflationary burn -- no SOL is returned to the viewer.
 * Fees are extracted from curve reserves into accrual fields.
 *
 * The instruction has NO arguments -- just the 8-byte discriminator.
 * The on-chain program reads burn_sol_price from the bonding curve and calculates
 * how many tokens to burn.
 */
export async function buildAndSendBurnForAccess(
  userId: string,
  mintAddress: string,
): Promise<{
  signature: string;
  tokensBurned: bigint;
}> {
  // 1. Get user signer
  const signer = await getUserSigner(userId);

  // 2. Read on-chain state to calculate expected tokens burned
  const bondingCurve = await readBondingCurveAccount(mintAddress);

  if (bondingCurve.burnSolPrice === BigInt(0)) {
    throw new Error("Burn is disabled for this token");
  }

  // 3. Calculate tokens that will be burned (for return value)
  const tokensRequired = calculateTokensForSolValue(
    bondingCurve.virtualSolReserves,
    bondingCurve.virtualTokenReserves,
    bondingCurve.burnSolPrice,
  );

  // 4. Derive PDAs
  const mintAddr = address(mintAddress);
  const pdas = await deriveTradePDAs(mintAddr);

  // 5. Derive viewer ATA
  const [viewerAta] = await findAssociatedTokenPda({
    owner: signer.address,
    tokenProgram: TOKEN_PROGRAM,
    mint: mintAddr,
  });

  // 6. Build burn_for_access instruction (discriminator only, no args)
  const burnInstruction: Instruction = {
    programAddress: PROGRAM_ID,
    accounts: [
      // viewer (signer, mut)
      { address: signer.address, role: AccountRole.WRITABLE_SIGNER },
      // global_config (readonly)
      { address: pdas.globalConfig, role: AccountRole.READONLY },
      // bonding_curve (mut)
      { address: pdas.bondingCurve, role: AccountRole.WRITABLE },
      // token_mint (mut -- tokens are burned, supply decreases)
      { address: mintAddr, role: AccountRole.WRITABLE },
      // viewer_token_account (mut)
      { address: viewerAta, role: AccountRole.WRITABLE },
      // token_program (readonly)
      { address: TOKEN_PROGRAM, role: AccountRole.READONLY },
    ],
    data: BURN_FOR_ACCESS_DISCRIMINATOR,
  };

  // 7. Build transaction message
  const rpc = createSolanaRpc(getRpcUrl());
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(signer.address, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstructions([burnInstruction], m),
  );

  // 8. Sign and send
  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage);
  const base64Tx = getBase64EncodedWireTransaction(signedTransaction);

  const txSignature = await rpc
    .sendTransaction(base64Tx, { encoding: "base64" })
    .send();

  return { signature: txSignature, tokensBurned: tokensRequired };
}

/**
 * Build, sign, and send a withdraw_creator_fees transaction.
 *
 * Withdraws accumulated creator trade fee SOL from the bonding curve PDA
 * to the creator's wallet. Only the token creator can call this.
 * Instruction has no arguments -- just the 8-byte discriminator.
 */
export async function buildAndSendWithdrawCreatorFees(
  userId: string,
  mintAddress: string,
): Promise<{
  signature: string;
  amount: bigint;
}> {
  // 1. Get user signer
  const signer = await getUserSigner(userId);

  // 2. Read on-chain bonding curve state
  const bondingCurve = await readBondingCurveAccount(mintAddress);

  // 3. Verify creator
  if (signer.address !== bondingCurve.creator) {
    throw new Error("Only the token creator can withdraw fees");
  }

  // 4. Verify fees > 0
  if (bondingCurve.creatorFeesAccrued === BigInt(0)) {
    throw new Error("No fees to withdraw");
  }

  const amount = bondingCurve.creatorFeesAccrued;

  // 5. Derive bonding curve PDA
  const mintAddr = address(mintAddress);
  const addressEncoder = getAddressEncoder();
  const mintBytes = addressEncoder.encode(mintAddr);

  const [bondingCurvePda] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["bonding_curve", mintBytes],
  });

  // 6. Build withdraw_creator_fees instruction (discriminator only, no args)
  const withdrawInstruction: Instruction = {
    programAddress: PROGRAM_ID,
    accounts: [
      // creator (signer, mut)
      { address: signer.address, role: AccountRole.WRITABLE_SIGNER },
      // bonding_curve (mut)
      { address: bondingCurvePda, role: AccountRole.WRITABLE },
      // token_mint (readonly)
      { address: mintAddr, role: AccountRole.READONLY },
    ],
    data: WITHDRAW_CREATOR_FEES_DISCRIMINATOR,
  };

  // 7. Build transaction message
  const rpc = createSolanaRpc(getRpcUrl());
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(signer.address, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstructions([withdrawInstruction], m),
  );

  // 8. Sign and send
  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage);
  const base64Tx = getBase64EncodedWireTransaction(signedTransaction);

  const txSignature = await rpc
    .sendTransaction(base64Tx, { encoding: "base64" })
    .send();

  return { signature: txSignature, amount };
}

/**
 * Build, sign, and send a claim_vested transaction.
 *
 * Claims vested creator tokens from the vesting PDA to the creator's ATA.
 * Only the token creator can call this.
 * Instruction has no arguments -- just the 8-byte discriminator.
 * Includes an idempotent create-ATA instruction to ensure the creator's
 * token account exists.
 */
export async function buildAndSendClaimVested(
  userId: string,
  mintAddress: string,
): Promise<{
  signature: string;
  amount: bigint;
}> {
  // 1. Get user signer
  const signer = await getUserSigner(userId);

  // 2. Read on-chain state
  const [vesting, globalConfig] = await Promise.all([
    readVestingAccount(mintAddress),
    readGlobalConfig(),
  ]);

  if (!vesting) {
    throw new Error("No vesting account found for this token");
  }

  // 3. Verify creator
  if (signer.address !== vesting.creator) {
    throw new Error("Only the token creator can claim vested tokens");
  }

  // 4. Calculate claimable
  const claimable = calculateClaimable(vesting, globalConfig);
  if (claimable === BigInt(0)) {
    throw new Error("No tokens available to claim");
  }

  // 5. Derive PDAs
  const mintAddr = address(mintAddress);
  const addressEncoder = getAddressEncoder();
  const mintBytes = addressEncoder.encode(mintAddr);

  const [globalConfigPda] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["global_config"],
  });

  const [vestingAccountPda] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["vesting", mintBytes],
  });

  const [vestingTokenAccountPda] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["vesting_tokens", mintBytes],
  });

  // 6. Derive creator ATA
  const [creatorAta] = await findAssociatedTokenPda({
    owner: signer.address,
    tokenProgram: TOKEN_PROGRAM,
    mint: mintAddr,
  });

  // 7. Build create-ATA-idempotent instruction (ensure creator ATA exists)
  const createAtaIx =
    await getCreateAssociatedTokenIdempotentInstructionAsync({
      payer: signer,
      owner: signer.address,
      mint: mintAddr,
    });

  // 8. Build claim_vested instruction (discriminator only, no args)
  const claimInstruction: Instruction = {
    programAddress: PROGRAM_ID,
    accounts: [
      // creator (signer, mut)
      { address: signer.address, role: AccountRole.WRITABLE_SIGNER },
      // global_config (readonly)
      { address: globalConfigPda, role: AccountRole.READONLY },
      // vesting_account (mut)
      { address: vestingAccountPda, role: AccountRole.WRITABLE },
      // token_mint (readonly)
      { address: mintAddr, role: AccountRole.READONLY },
      // vesting_token_account (mut)
      { address: vestingTokenAccountPda, role: AccountRole.WRITABLE },
      // creator_token_account (mut)
      { address: creatorAta, role: AccountRole.WRITABLE },
      // token_program (readonly)
      { address: TOKEN_PROGRAM, role: AccountRole.READONLY },
    ],
    data: CLAIM_VESTED_DISCRIMINATOR,
  };

  // 9. Build transaction message
  const rpc = createSolanaRpc(getRpcUrl());
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(signer.address, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) =>
      appendTransactionMessageInstructions(
        [createAtaIx, claimInstruction],
        m,
      ),
  );

  // 10. Sign and send
  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage);
  const base64Tx = getBase64EncodedWireTransaction(signedTransaction);

  const txSignature = await rpc
    .sendTransaction(base64Tx, { encoding: "base64" })
    .send();

  return { signature: txSignature, amount: claimable };
}
