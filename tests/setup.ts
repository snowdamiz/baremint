import { startAnchor, BankrunProvider } from "anchor-bankrun";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { ProgramTestContext, Clock } from "solana-bankrun";
import { Baremint } from "../target/types/baremint";
import IDL from "../target/idl/baremint.json";
import BN from "bn.js";

// ------- Constants -------

export const PROGRAM_ID = new PublicKey(
  "FTAssMPiQ8EQUeJA4Rnu6c71maCrUCdnvGetWnVdTXTG"
);

export const TOTAL_SUPPLY = BigInt("1000000000000000"); // 1B with 6 decimals
export const VESTING_AMOUNT = BigInt("100000000000000"); // 100M (10% of 1B)
export const CURVE_AMOUNT = BigInt("900000000000000"); // 900M (90% of 1B)
export const LAMPORTS_PER_SOL = BigInt("1000000000");
export const DEFAULT_FEE_BPS = 500;
export const DEFAULT_PLATFORM_FEE_BPS = 250;
export const DEFAULT_CREATOR_FEE_BPS = 250;
export const DEFAULT_VIRTUAL_TOKEN_RESERVES = new BN("1073000000000000"); // 1.073B with 6 decimals
export const DEFAULT_VIRTUAL_SOL_RESERVES = new BN("30000000000"); // 30 SOL
export const SECONDS_PER_DAY = 86400;

// ------- TypeScript Math Mirrors -------

/**
 * Mirror of Rust calculate_buy_tokens (constant product, floor division)
 */
export function calculateBuyTokens(
  virtualSol: bigint,
  virtualToken: bigint,
  solAmount: bigint
): bigint {
  if (solAmount === BigInt(0)) return BigInt(0);
  const k = virtualSol * virtualToken;
  const newVirtualSol = virtualSol + solAmount;
  const newVirtualToken = k / newVirtualSol;
  return virtualToken - newVirtualToken;
}

/**
 * Mirror of Rust calculate_sell_sol (constant product, floor division)
 */
export function calculateSellSol(
  virtualSol: bigint,
  virtualToken: bigint,
  tokenAmount: bigint
): bigint {
  if (tokenAmount === BigInt(0)) return BigInt(0);
  const k = virtualSol * virtualToken;
  const newVirtualToken = virtualToken + tokenAmount;
  const newVirtualSol = k / newVirtualToken;
  return virtualSol - newVirtualSol;
}

/**
 * Mirror of Rust calculate_fee (ceiling division)
 */
export function calculateFee(amount: bigint, feeBps: number): bigint {
  if (amount === BigInt(0) || feeBps === 0) return BigInt(0);
  const numerator = amount * BigInt(feeBps) + BigInt(9999);
  return numerator / BigInt(10000);
}

/**
 * Mirror of Rust calculate_tokens_for_sol_value (ceiling division)
 */
export function calculateTokensForSolValue(
  virtualSol: bigint,
  virtualToken: bigint,
  solValue: bigint
): bigint {
  if (solValue === BigInt(0)) return BigInt(0);
  const numerator = solValue * virtualToken + (virtualSol - BigInt(1));
  return numerator / virtualSol;
}

// ------- Setup Helpers -------

export interface TestContext {
  context: ProgramTestContext;
  provider: BankrunProvider;
  program: Program<Baremint>;
}

/**
 * Start bankrun with the baremint program loaded
 */
export async function setupTest(): Promise<TestContext> {
  const context = await startAnchor("", [], []);
  const provider = new BankrunProvider(context);
  const program = new Program<Baremint>(IDL as any, provider);
  return { context, provider, program };
}

/**
 * Initialize GlobalConfig with default params
 */
export async function initializeGlobalConfig(
  program: Program<Baremint>,
  authority: Keypair
): Promise<PublicKey> {
  const [globalConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    program.programId
  );

  await program.methods
    .initialize(
      DEFAULT_FEE_BPS,
      DEFAULT_PLATFORM_FEE_BPS,
      DEFAULT_CREATOR_FEE_BPS,
      DEFAULT_VIRTUAL_TOKEN_RESERVES,
      DEFAULT_VIRTUAL_SOL_RESERVES
    )
    .accounts({
      authority: authority.publicKey,
      globalConfig: globalConfigPda,
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc();

  return globalConfigPda;
}

/**
 * Create a token via create_token instruction
 */
export async function createToken(
  program: Program<Baremint>,
  context: ProgramTestContext,
  creator: Keypair,
  burnSolPrice: BN = new BN(0)
): Promise<{ tokenMint: Keypair; bondingCurvePda: PublicKey }> {
  const tokenMint = Keypair.generate();

  const [globalConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    program.programId
  );
  const [creatorProfilePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator_profile"), creator.publicKey.toBuffer()],
    program.programId
  );
  const [bondingCurvePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), tokenMint.publicKey.toBuffer()],
    program.programId
  );
  const [curveTokenAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("curve_tokens"), tokenMint.publicKey.toBuffer()],
    program.programId
  );
  const [vestingAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vesting"), tokenMint.publicKey.toBuffer()],
    program.programId
  );
  const [vestingTokenAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vesting_tokens"), tokenMint.publicKey.toBuffer()],
    program.programId
  );

  await program.methods
    .createToken(burnSolPrice)
    .accounts({
      creator: creator.publicKey,
      globalConfig: globalConfigPda,
      creatorProfile: creatorProfilePda,
      tokenMint: tokenMint.publicKey,
      bondingCurve: bondingCurvePda,
      curveTokenAccount: curveTokenAccountPda,
      vestingAccount: vestingAccountPda,
      vestingTokenAccount: vestingTokenAccountPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: PublicKey.findProgramAddressSync(
        [],
        new PublicKey("SysvarRent111111111111111111111111111111111")
      )[0],
    })
    .accounts({
      rent: new PublicKey("SysvarRent111111111111111111111111111111111"),
    })
    .signers([creator, tokenMint])
    .rpc();

  return { tokenMint, bondingCurvePda };
}

/**
 * Create an associated token account for a user
 */
export async function createATA(
  context: ProgramTestContext,
  provider: BankrunProvider,
  mint: PublicKey,
  owner: PublicKey,
  payer: Keypair
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(mint, owner);
  const ix = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ata,
    owner,
    mint
  );
  const tx = new Transaction().add(ix);
  tx.recentBlockhash = context.lastBlockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);
  await context.banksClient.processTransaction(tx);
  return ata;
}

/**
 * Airdrop SOL to an account in bankrun
 */
export async function airdropSol(
  context: ProgramTestContext,
  to: PublicKey,
  lamports: number
): Promise<void> {
  const currentAccount = await context.banksClient.getAccount(to);
  const currentLamports = currentAccount ? currentAccount.lamports : BigInt(0);
  context.setAccount(to, {
    lamports: currentLamports + BigInt(lamports),
    data: currentAccount ? Buffer.from(currentAccount.data) : Buffer.alloc(0),
    owner: currentAccount
      ? currentAccount.owner
      : new PublicKey("11111111111111111111111111111111"),
    executable: false,
  });
}

/**
 * Get bonding curve PDA and related accounts for a token
 */
export function getTokenAccounts(
  programId: PublicKey,
  tokenMint: PublicKey
): {
  bondingCurvePda: PublicKey;
  curveTokenAccountPda: PublicKey;
  vestingAccountPda: PublicKey;
  vestingTokenAccountPda: PublicKey;
  globalConfigPda: PublicKey;
} {
  const [bondingCurvePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), tokenMint.toBuffer()],
    programId
  );
  const [curveTokenAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("curve_tokens"), tokenMint.toBuffer()],
    programId
  );
  const [vestingAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vesting"), tokenMint.toBuffer()],
    programId
  );
  const [vestingTokenAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vesting_tokens"), tokenMint.toBuffer()],
    programId
  );
  const [globalConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    programId
  );
  return {
    bondingCurvePda,
    curveTokenAccountPda,
    vestingAccountPda,
    vestingTokenAccountPda,
    globalConfigPda,
  };
}

/**
 * Advance the bankrun clock by a given number of seconds
 */
export async function advanceClock(
  context: ProgramTestContext,
  seconds: number
): Promise<void> {
  const currentClock = await context.banksClient.getClock();
  const newClock = new Clock(
    currentClock.slot,
    currentClock.epochStartTimestamp,
    currentClock.epoch,
    currentClock.leaderScheduleEpoch,
    currentClock.unixTimestamp + BigInt(seconds)
  );
  context.setClock(newClock);
}
