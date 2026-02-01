/**
 * Fetch SPL token balance for a wallet+mint pair via Helius RPC.
 *
 * Uses JSON-RPC getTokenAccountsByOwner with jsonParsed encoding
 * to get human-readable token amounts without manual deserialization.
 */

/**
 * Get the token balance for a wallet address and mint address.
 * Returns the raw token amount as BigInt (before decimal adjustment).
 *
 * @param walletAddress - The Solana wallet public key
 * @param mintAddress - The SPL token mint address
 * @returns Token balance as BigInt (0 if no token accounts found)
 */
export async function getTokenBalance(
  walletAddress: string,
  mintAddress: string,
): Promise<bigint> {
  const rpcUrl = process.env.HELIUS_RPC_URL;
  if (!rpcUrl) {
    throw new Error(
      "HELIUS_RPC_URL is not configured. Set HELIUS_RPC_URL environment variable.",
    );
  }

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [
        walletAddress,
        { mint: mintAddress },
        { encoding: "jsonParsed" },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Helius RPC request failed: ${response.status} ${response.statusText}`,
    );
  }

  const json = await response.json();

  if (json.error) {
    throw new Error(
      `Helius RPC error: ${json.error.message ?? JSON.stringify(json.error)}`,
    );
  }

  const accounts = json.result?.value;
  if (!accounts || accounts.length === 0) {
    return BigInt(0);
  }

  // Sum all token account balances for this mint (usually just one)
  let total = BigInt(0);
  for (const account of accounts) {
    const amount =
      account?.account?.data?.parsed?.info?.tokenAmount?.amount;
    if (amount) {
      total += BigInt(amount);
    }
  }

  return total;
}
