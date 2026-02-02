/**
 * VestingAccount PDA deserialization and claimable calculation.
 *
 * Reads on-chain VestingAccount using @solana/kit RPC.
 * Field layout matches the Anchor account struct in programs/baremint/src/state/.
 */

import {
  createSolanaRpc,
  getAddressDecoder,
  getAddressEncoder,
  getProgramDerivedAddress,
  address,
} from "@solana/kit";
import type { Address } from "@solana/kit";
import type { GlobalConfigAccount } from "./bonding-curve-read";

const DEVNET_RPC = "https://api.devnet.solana.com";
const PROGRAM_ID: Address =
  "FTAssMPiQ8EQUeJA4Rnu6c71maCrUCdnvGetWnVdTXTG" as Address;

function getRpcUrl(): string {
  return process.env.HELIUS_RPC_URL || DEVNET_RPC;
}

// ──────────────────────────────────────────────
// VestingAccount deserialization
// ──────────────────────────────────────────────

export interface VestingAccountData {
  creator: Address;
  tokenMint: Address;
  totalAllocation: bigint;
  claimedAmount: bigint;
  startTimestamp: bigint;
  isRevoked: boolean;
  bump: number;
}

/**
 * Deserialize raw account data into a VestingAccount object.
 *
 * Layout (after 8-byte Anchor discriminator):
 *   creator:           Pubkey (32 bytes)
 *   token_mint:        Pubkey (32 bytes)
 *   total_allocation:  u64 LE (8 bytes)
 *   claimed_amount:    u64 LE (8 bytes)
 *   start_timestamp:   i64 LE (8 bytes)
 *   is_revoked:        bool (1 byte)
 *   bump:              u8 (1 byte)
 */
export function deserializeVestingAccount(
  data: Uint8Array,
): VestingAccountData {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 8; // skip Anchor discriminator

  const addressDecoder = getAddressDecoder();

  // creator (32 bytes)
  const creatorBytes = data.slice(offset, offset + 32);
  const creator = addressDecoder.decode(creatorBytes);
  offset += 32;

  // token_mint (32 bytes)
  const tokenMintBytes = data.slice(offset, offset + 32);
  const tokenMint = addressDecoder.decode(tokenMintBytes);
  offset += 32;

  // total_allocation (u64 LE)
  const totalAllocation = view.getBigUint64(offset, true);
  offset += 8;

  // claimed_amount (u64 LE)
  const claimedAmount = view.getBigUint64(offset, true);
  offset += 8;

  // start_timestamp (i64 LE)
  const startTimestamp = view.getBigInt64(offset, true);
  offset += 8;

  // is_revoked (1 byte)
  const isRevoked = data[offset] !== 0;
  offset += 1;

  // bump (1 byte)
  const bump = data[offset];

  return {
    creator,
    tokenMint,
    totalAllocation,
    claimedAmount,
    startTimestamp,
    isRevoked,
    bump,
  };
}

/**
 * Read and deserialize a VestingAccount PDA from chain.
 * Returns null if the account doesn't exist.
 */
export async function readVestingAccount(
  mintAddress: string,
): Promise<VestingAccountData | null> {
  const rpc = createSolanaRpc(getRpcUrl());
  const addressEncoder = getAddressEncoder();
  const mintBytes = addressEncoder.encode(address(mintAddress));

  const [vestingAddress] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["vesting", mintBytes],
  });

  const { value: accountInfo } = await rpc
    .getAccountInfo(vestingAddress, { encoding: "base64" })
    .send();

  if (!accountInfo) {
    return null;
  }

  // accountInfo.data is [base64String, "base64"]
  const base64Data = accountInfo.data[0] as string;
  const rawBytes = Buffer.from(base64Data, "base64");

  return deserializeVestingAccount(new Uint8Array(rawBytes));
}

// ──────────────────────────────────────────────
// Claimable calculation
// ──────────────────────────────────────────────

/**
 * Calculate the claimable token amount for a vesting account.
 *
 * Uses the same weekly-snapping logic as the on-chain program:
 * 1. If revoked, return 0
 * 2. If before cliff end, return 0
 * 3. Calculate elapsed since cliff, cap at vesting duration
 * 4. Snap to weekly intervals (floor division)
 * 5. Linear vesting: totalVested = (totalAllocation * snappedElapsed) / vestingDuration
 * 6. Claimable = totalVested - claimedAmount (min 0)
 */
export function calculateClaimable(
  vesting: VestingAccountData,
  config: GlobalConfigAccount,
): bigint {
  if (vesting.isRevoked) {
    return BigInt(0);
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const cliffEnd = vesting.startTimestamp + config.vestingCliffSeconds;

  if (now < cliffEnd) {
    return BigInt(0);
  }

  // Elapsed time since cliff ended
  let elapsed = now - cliffEnd;

  // Cap at vesting duration
  if (elapsed > config.vestingDurationSeconds) {
    elapsed = config.vestingDurationSeconds;
  }

  // Weekly snapping: floor division by claim interval, then multiply back
  const intervalsElapsed =
    elapsed / config.vestingClaimIntervalSeconds;
  const snappedElapsed =
    intervalsElapsed * config.vestingClaimIntervalSeconds;

  // Linear vesting: totalVested = (totalAllocation * snappedElapsed) / vestingDuration
  const totalVested =
    (vesting.totalAllocation * snappedElapsed) /
    config.vestingDurationSeconds;

  // Claimable = totalVested - claimedAmount (min 0)
  const claimable = totalVested - vesting.claimedAmount;
  return claimable > BigInt(0) ? claimable : BigInt(0);
}
