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
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  getAddressEncoder,
  getProgramDerivedAddress,
  getU64Encoder,
  AccountRole,
  address,
} from "@solana/kit";
import type { Address, Instruction } from "@solana/kit";
import { db } from "@/lib/db";
import { wallet } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decryptPrivateKey, getEncryptionKey } from "./keypair";

const DEVNET_RPC = "https://api.devnet.solana.com";
const PROGRAM_ID: Address =
  "FTAssMPiQ8EQUeJA4Rnu6c71maCrUCdnvGetWnVdTXTG" as Address;
const TOKEN_PROGRAM: Address =
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address;
const SYSTEM_PROGRAM: Address =
  "11111111111111111111111111111111" as Address;
const RENT_SYSVAR: Address =
  "SysvarRent111111111111111111111111111111111" as Address;

// Anchor instruction discriminator from IDL
const CREATE_TOKEN_DISCRIMINATOR = new Uint8Array([84, 52, 204, 228, 24, 140, 234, 75]);

function getRpcUrl(): string {
  return process.env.HELIUS_RPC_URL || DEVNET_RPC;
}

/**
 * Derive all PDAs needed for the create_token instruction.
 */
async function deriveCreateTokenPDAs(
  mintAddress: Address,
  creatorAddress: Address,
) {
  const addressEncoder = getAddressEncoder();
  const mintBytes = addressEncoder.encode(mintAddress);
  const creatorBytes = addressEncoder.encode(creatorAddress);

  const [globalConfig] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["global_config"],
  });

  const [creatorProfile] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["creator_profile", creatorBytes],
  });

  const [bondingCurve] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["bonding_curve", mintBytes],
  });

  const [curveTokenAccount] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["curve_tokens", mintBytes],
  });

  const [vestingAccount] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["vesting", mintBytes],
  });

  const [vestingTokenAccount] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["vesting_tokens", mintBytes],
  });

  return {
    globalConfig,
    creatorProfile,
    bondingCurve,
    curveTokenAccount,
    vestingAccount,
    vestingTokenAccount,
  };
}

/**
 * Build the create_token instruction data.
 * Layout: [8-byte discriminator][8-byte burn_sol_price (u64 LE)]
 */
function buildCreateTokenInstructionData(burnSolPrice: bigint): Uint8Array {
  const u64Encoder = getU64Encoder();
  const burnPriceBytes = u64Encoder.encode(burnSolPrice);

  const data = new Uint8Array(8 + 8);
  data.set(CREATE_TOKEN_DISCRIMINATOR, 0);
  data.set(new Uint8Array(burnPriceBytes), 8);
  return data;
}

/**
 * Build, sign, and send a create_token transaction on the Baremint program.
 *
 * Follows the same @solana/kit pipe pattern as lib/solana/transfer.ts.
 *
 * @param userId - The authenticated user initiating token creation
 * @param burnSolPrice - Cost in lamports to burn tokens for content access
 * @returns Transaction signature and all derived on-chain addresses
 */
export async function buildAndSendCreateToken(
  userId: string,
  burnSolPrice: bigint,
): Promise<{
  signature: string;
  mintAddress: string;
  bondingCurveAddress: string;
  vestingAddress: string;
}> {
  // 1. Get user wallet
  const userWallet = await db.query.wallet.findFirst({
    where: eq(wallet.userId, userId),
  });

  if (!userWallet) {
    throw new Error("No wallet found for user");
  }

  // 2. Decrypt private key and create creator signer
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

  const creatorSigner = await createKeyPairSignerFromBytes(keypairBytes);

  // 3. Generate new keypair for the token mint (co-signer)
  const mintSigner = await generateKeyPairSigner();

  // 4. Check creator wallet balance
  const rpc = createSolanaRpc(getRpcUrl());
  const { value: balance } = await rpc
    .getBalance(creatorSigner.address)
    .send();

  // Need at least 0.05 SOL for rent + fees (7 account inits)
  const MIN_BALANCE = BigInt(50_000_000); // 0.05 SOL
  if (balance < MIN_BALANCE) {
    throw new Error(
      `Insufficient SOL balance. Need at least 0.05 SOL, have ${(Number(balance) / 1e9).toFixed(4)} SOL`,
    );
  }

  // 5. Derive all PDAs
  const pdas = await deriveCreateTokenPDAs(
    mintSigner.address,
    creatorSigner.address,
  );

  // 6. Build instruction
  const instructionData = buildCreateTokenInstructionData(burnSolPrice);

  const createTokenInstruction: Instruction = {
    programAddress: PROGRAM_ID,
    accounts: [
      // creator (signer, mut)
      {
        address: creatorSigner.address,
        role: AccountRole.WRITABLE_SIGNER,
      },
      // global_config
      {
        address: pdas.globalConfig,
        role: AccountRole.READONLY,
      },
      // creator_profile (mut)
      {
        address: pdas.creatorProfile,
        role: AccountRole.WRITABLE,
      },
      // token_mint (signer, mut)
      {
        address: mintSigner.address,
        role: AccountRole.WRITABLE_SIGNER,
      },
      // bonding_curve (mut)
      {
        address: pdas.bondingCurve,
        role: AccountRole.WRITABLE,
      },
      // curve_token_account (mut)
      {
        address: pdas.curveTokenAccount,
        role: AccountRole.WRITABLE,
      },
      // vesting_account (mut)
      {
        address: pdas.vestingAccount,
        role: AccountRole.WRITABLE,
      },
      // vesting_token_account (mut)
      {
        address: pdas.vestingTokenAccount,
        role: AccountRole.WRITABLE,
      },
      // token_program
      {
        address: TOKEN_PROGRAM,
        role: AccountRole.READONLY,
      },
      // system_program
      {
        address: SYSTEM_PROGRAM,
        role: AccountRole.READONLY,
      },
      // rent
      {
        address: RENT_SYSVAR,
        role: AccountRole.READONLY,
      },
    ],
    data: instructionData,
  };

  // 7. Build transaction message using pipe pattern
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(creatorSigner.address, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstruction(createTokenInstruction, m),
  );

  // 8. Sign with both creator and mint keypair signers
  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage);

  // 9. Send transaction
  const base64EncodedTransaction =
    getBase64EncodedWireTransaction(signedTransaction);

  const txSignature = await rpc
    .sendTransaction(base64EncodedTransaction, {
      encoding: "base64",
    })
    .send();

  return {
    signature: txSignature,
    mintAddress: mintSigner.address,
    bondingCurveAddress: pdas.bondingCurve,
    vestingAddress: pdas.vestingAccount,
  };
}
