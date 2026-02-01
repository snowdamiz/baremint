import { createSolanaRpc } from "@solana/kit";
import type { Address } from "@solana/kit";

const DEVNET_RPC = "https://api.devnet.solana.com";

function getRpcUrl(): string {
  return process.env.HELIUS_RPC_URL || DEVNET_RPC;
}

/**
 * Fetch the SOL balance for a Solana address.
 * Returns the balance in lamports (bigint).
 */
export async function getSolBalance(publicKey: string): Promise<bigint> {
  try {
    const rpc = createSolanaRpc(getRpcUrl());
    const { value } = await rpc
      .getBalance(publicKey as Address)
      .send();
    return value;
  } catch (error) {
    console.error("Failed to fetch SOL balance:", error);
    return BigInt(0);
  }
}

/**
 * Convert lamports to SOL (1 SOL = 1_000_000_000 lamports).
 */
export function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / 1_000_000_000;
}
