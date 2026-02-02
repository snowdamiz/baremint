/**
 * BondingCurve PDA account deserialization and reserve reading.
 *
 * Reads on-chain BondingCurve and GlobalConfig accounts using @solana/kit RPC.
 * Field layouts match the Anchor account structs in programs/baremint/src/state/.
 */

import {
  createSolanaRpc,
  getAddressDecoder,
  getAddressEncoder,
  getProgramDerivedAddress,
  address,
} from "@solana/kit";
import type { Address } from "@solana/kit";

const DEVNET_RPC = "https://api.devnet.solana.com";
const PROGRAM_ID: Address =
  "FTAssMPiQ8EQUeJA4Rnu6c71maCrUCdnvGetWnVdTXTG" as Address;

function getRpcUrl(): string {
  return process.env.HELIUS_RPC_URL || DEVNET_RPC;
}

// ──────────────────────────────────────────────
// BondingCurve deserialization
// ──────────────────────────────────────────────

export interface BondingCurveAccount {
  tokenMint: Address;
  creator: Address;
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  tokenTotalSupply: bigint;
  burnSolPrice: bigint;
  platformFeesAccrued: bigint;
  creatorFeesAccrued: bigint;
  bump: number;
}

/**
 * Deserialize raw account data into a BondingCurve object.
 *
 * Layout (after 8-byte Anchor discriminator):
 *   token_mint:             Pubkey (32 bytes)
 *   creator:                Pubkey (32 bytes)
 *   virtual_token_reserves: u64 LE (8 bytes)
 *   virtual_sol_reserves:   u64 LE (8 bytes)
 *   real_token_reserves:    u64 LE (8 bytes)
 *   real_sol_reserves:      u64 LE (8 bytes)
 *   token_total_supply:     u64 LE (8 bytes)
 *   burn_sol_price:         u64 LE (8 bytes)
 *   platform_fees_accrued:  u64 LE (8 bytes)
 *   creator_fees_accrued:   u64 LE (8 bytes)
 *   bump:                   u8 (1 byte)
 */
export function deserializeBondingCurve(data: Uint8Array): BondingCurveAccount {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 8; // skip Anchor discriminator

  const addressDecoder = getAddressDecoder();

  // token_mint (32 bytes)
  const tokenMintBytes = data.slice(offset, offset + 32);
  const tokenMint = addressDecoder.decode(tokenMintBytes);
  offset += 32;

  // creator (32 bytes)
  const creatorBytes = data.slice(offset, offset + 32);
  const creator = addressDecoder.decode(creatorBytes);
  offset += 32;

  // u64 fields (8 bytes each, little-endian)
  const virtualTokenReserves = view.getBigUint64(offset, true);
  offset += 8;
  const virtualSolReserves = view.getBigUint64(offset, true);
  offset += 8;
  const realTokenReserves = view.getBigUint64(offset, true);
  offset += 8;
  const realSolReserves = view.getBigUint64(offset, true);
  offset += 8;
  const tokenTotalSupply = view.getBigUint64(offset, true);
  offset += 8;
  const burnSolPrice = view.getBigUint64(offset, true);
  offset += 8;
  const platformFeesAccrued = view.getBigUint64(offset, true);
  offset += 8;
  const creatorFeesAccrued = view.getBigUint64(offset, true);
  offset += 8;

  // bump (1 byte)
  const bump = data[offset];

  return {
    tokenMint,
    creator,
    virtualTokenReserves,
    virtualSolReserves,
    realTokenReserves,
    realSolReserves,
    tokenTotalSupply,
    burnSolPrice,
    platformFeesAccrued,
    creatorFeesAccrued,
    bump,
  };
}

/**
 * Read and deserialize a BondingCurve PDA account from chain.
 */
export async function readBondingCurveAccount(
  mintAddress: string,
): Promise<BondingCurveAccount> {
  const rpc = createSolanaRpc(getRpcUrl());
  const addressEncoder = getAddressEncoder();
  const mintBytes = addressEncoder.encode(address(mintAddress));

  const [bondingCurveAddress] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["bonding_curve", mintBytes],
  });

  const { value: accountInfo } = await rpc
    .getAccountInfo(bondingCurveAddress, { encoding: "base64" })
    .send();

  if (!accountInfo) {
    throw new Error(
      `BondingCurve account not found for mint ${mintAddress}`,
    );
  }

  // accountInfo.data is [base64String, "base64"]
  const base64Data = accountInfo.data[0] as string;
  const rawBytes = Buffer.from(base64Data, "base64");

  return deserializeBondingCurve(new Uint8Array(rawBytes));
}

// ──────────────────────────────────────────────
// GlobalConfig deserialization
// ──────────────────────────────────────────────

export interface GlobalConfigAccount {
  authority: Address;
  feeBps: number;
  platformFeeBps: number;
  creatorFeeBps: number;
  initialVirtualTokenReserves: bigint;
  initialVirtualSolReserves: bigint;
  vestingCliffSeconds: bigint;
  vestingDurationSeconds: bigint;
  vestingClaimIntervalSeconds: bigint;
  launchCooldownSeconds: bigint;
  creatorAllocationBps: number;
  bump: number;
}

/**
 * Deserialize raw account data into a GlobalConfig object.
 *
 * Layout (after 8-byte Anchor discriminator):
 *   authority:                        Pubkey (32 bytes)
 *   fee_bps:                          u16 LE (2 bytes)
 *   platform_fee_bps:                 u16 LE (2 bytes)
 *   creator_fee_bps:                  u16 LE (2 bytes)
 *   initial_virtual_token_reserves:   u64 LE (8 bytes)
 *   initial_virtual_sol_reserves:     u64 LE (8 bytes)
 *   vesting_cliff_seconds:            i64 LE (8 bytes)
 *   vesting_duration_seconds:         i64 LE (8 bytes)
 *   vesting_claim_interval_seconds:   i64 LE (8 bytes)
 *   launch_cooldown_seconds:          i64 LE (8 bytes)
 *   creator_allocation_bps:           u16 LE (2 bytes)
 *   bump:                             u8 (1 byte)
 */
export function deserializeGlobalConfig(
  data: Uint8Array,
): GlobalConfigAccount {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 8; // skip Anchor discriminator

  const addressDecoder = getAddressDecoder();

  // authority (32 bytes)
  const authorityBytes = data.slice(offset, offset + 32);
  const authority = addressDecoder.decode(authorityBytes);
  offset += 32;

  // fee_bps (u16 LE)
  const feeBps = view.getUint16(offset, true);
  offset += 2;

  // platform_fee_bps (u16 LE)
  const platformFeeBps = view.getUint16(offset, true);
  offset += 2;

  // creator_fee_bps (u16 LE)
  const creatorFeeBps = view.getUint16(offset, true);
  offset += 2;

  // Anchor may add padding after u16 fields before u64 — check alignment
  // Actually, Anchor uses borsh serialization which packs tightly (no padding).

  // initial_virtual_token_reserves (u64 LE)
  const initialVirtualTokenReserves = view.getBigUint64(offset, true);
  offset += 8;

  // initial_virtual_sol_reserves (u64 LE)
  const initialVirtualSolReserves = view.getBigUint64(offset, true);
  offset += 8;

  // vesting_cliff_seconds (i64 LE)
  const vestingCliffSeconds = view.getBigInt64(offset, true);
  offset += 8;

  // vesting_duration_seconds (i64 LE)
  const vestingDurationSeconds = view.getBigInt64(offset, true);
  offset += 8;

  // vesting_claim_interval_seconds (i64 LE)
  const vestingClaimIntervalSeconds = view.getBigInt64(offset, true);
  offset += 8;

  // launch_cooldown_seconds (i64 LE)
  const launchCooldownSeconds = view.getBigInt64(offset, true);
  offset += 8;

  // creator_allocation_bps (u16 LE)
  const creatorAllocationBps = view.getUint16(offset, true);
  offset += 2;

  // bump (u8)
  const bump = data[offset];

  return {
    authority,
    feeBps,
    platformFeeBps,
    creatorFeeBps,
    initialVirtualTokenReserves,
    initialVirtualSolReserves,
    vestingCliffSeconds,
    vestingDurationSeconds,
    vestingClaimIntervalSeconds,
    launchCooldownSeconds,
    creatorAllocationBps,
    bump,
  };
}

/**
 * Read and deserialize the GlobalConfig PDA account from chain.
 */
export async function readGlobalConfig(): Promise<GlobalConfigAccount> {
  const rpc = createSolanaRpc(getRpcUrl());

  const [globalConfigAddress] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["global_config"],
  });

  const { value: accountInfo } = await rpc
    .getAccountInfo(globalConfigAddress, { encoding: "base64" })
    .send();

  if (!accountInfo) {
    throw new Error("GlobalConfig account not found");
  }

  const base64Data = accountInfo.data[0] as string;
  const rawBytes = Buffer.from(base64Data, "base64");

  return deserializeGlobalConfig(new Uint8Array(rawBytes));
}
