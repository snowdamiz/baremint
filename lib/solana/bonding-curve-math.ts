/**
 * Bonding Curve Math — TypeScript port of programs/baremint/src/math.rs
 *
 * All arithmetic uses BigInt to match on-chain u64/u128 precision exactly.
 * Curve calculations use floor division (protocol-favorable).
 * Fee calculations use ceiling division (protocol-favorable).
 */

/**
 * Calculate tokens received for a given SOL input using constant product formula.
 * k = virtualSol * virtualToken (invariant)
 * Rounds DOWN (floor division — buyer gets fewer tokens).
 */
export function calculateBuyTokens(
  virtualSolReserves: bigint,
  virtualTokenReserves: bigint,
  solAmount: bigint,
): bigint {
  if (solAmount === BigInt(0)) return BigInt(0);

  const k = virtualSolReserves * virtualTokenReserves;
  const newVirtualSol = virtualSolReserves + solAmount;
  const newVirtualToken = k / newVirtualSol; // floor division
  return virtualTokenReserves - newVirtualToken;
}

/**
 * Calculate SOL received for selling tokens using constant product formula.
 * Rounds DOWN (floor division — seller gets less SOL).
 */
export function calculateSellSol(
  virtualSolReserves: bigint,
  virtualTokenReserves: bigint,
  tokenAmount: bigint,
): bigint {
  if (tokenAmount === BigInt(0)) return BigInt(0);

  const k = virtualSolReserves * virtualTokenReserves;
  const newVirtualToken = virtualTokenReserves + tokenAmount;
  const newVirtualSol = k / newVirtualToken; // floor division
  return virtualSolReserves - newVirtualSol;
}

/**
 * Calculate fee amount. Rounds UP (ceiling division — more fees collected).
 * fee = ceil(amount * feeBps / 10_000)
 */
export function calculateFee(amount: bigint, feeBps: number): bigint {
  if (amount === BigInt(0) || feeBps === 0) return BigInt(0);

  // Ceiling division: (amount * bps + 9999) / 10000
  const numerator = amount * BigInt(feeBps) + BigInt(9999);
  return numerator / BigInt(10000);
}

/**
 * Estimate buy: fee deducted BEFORE curve calc (matches on-chain buy.rs).
 *
 * Flow: totalFee = ceil(solAmount * feeBps / 10000)
 *       solIntoCurve = solAmount - totalFee
 *       tokensOut = constant_product(solIntoCurve)
 */
export function estimateBuy(
  solAmount: bigint,
  feeBps: number,
  virtualSol: bigint,
  virtualToken: bigint,
): {
  tokensOut: bigint;
  totalFee: bigint;
  platformFee: bigint;
  creatorFee: bigint;
  solIntoCurve: bigint;
} {
  if (solAmount === BigInt(0)) {
    return {
      tokensOut: BigInt(0),
      totalFee: BigInt(0),
      platformFee: BigInt(0),
      creatorFee: BigInt(0),
      solIntoCurve: BigInt(0),
    };
  }

  const totalFee = calculateFee(solAmount, feeBps);
  const platformFee = totalFee / BigInt(2);
  const creatorFee = totalFee - platformFee;
  const solIntoCurve = solAmount - totalFee;
  const tokensOut = calculateBuyTokens(virtualSol, virtualToken, solIntoCurve);

  return { tokensOut, totalFee, platformFee, creatorFee, solIntoCurve };
}

/**
 * Estimate sell: fee deducted AFTER curve calc (matches on-chain sell.rs).
 *
 * Flow: grossSol = constant_product(tokenAmount)
 *       totalFee = ceil(grossSol * feeBps / 10000)
 *       netSol = grossSol - totalFee
 */
export function estimateSell(
  tokenAmount: bigint,
  feeBps: number,
  virtualSol: bigint,
  virtualToken: bigint,
): {
  netSol: bigint;
  grossSol: bigint;
  totalFee: bigint;
  platformFee: bigint;
  creatorFee: bigint;
} {
  if (tokenAmount === BigInt(0)) {
    return {
      netSol: BigInt(0),
      grossSol: BigInt(0),
      totalFee: BigInt(0),
      platformFee: BigInt(0),
      creatorFee: BigInt(0),
    };
  }

  const grossSol = calculateSellSol(virtualSol, virtualToken, tokenAmount);
  const totalFee = calculateFee(grossSol, feeBps);
  const platformFee = totalFee / BigInt(2);
  const creatorFee = totalFee - platformFee;
  const netSol = grossSol - totalFee;

  return { netSol, grossSol, totalFee, platformFee, creatorFee };
}

/**
 * Calculate how many tokens a given SOL value is worth at current reserves.
 * Used for burn-for-access pricing.
 * Rounds UP (ceiling division — protocol-favorable: more tokens burned).
 * tokens = ceil(solValue * virtualTokenReserves / virtualSolReserves)
 *
 * Matches Rust: programs/baremint/src/math.rs::calculate_tokens_for_sol_value
 */
export function calculateTokensForSolValue(
  virtualSolReserves: bigint,
  virtualTokenReserves: bigint,
  solValue: bigint,
): bigint {
  if (solValue === BigInt(0)) return BigInt(0);

  // Ceiling division: (solValue * virtualTokenReserves + virtualSolReserves - 1) / virtualSolReserves
  const numerator =
    solValue * virtualTokenReserves + (virtualSolReserves - BigInt(1));
  return numerator / virtualSolReserves;
}

/**
 * Calculate spot price as a rational number (avoids floating point).
 * Price = virtualSolReserves / virtualTokenReserves (SOL per token)
 */
export function calculatePricePerToken(
  virtualSolReserves: bigint,
  virtualTokenReserves: bigint,
): { priceNum: bigint; priceDenom: bigint } {
  return {
    priceNum: virtualSolReserves,
    priceDenom: virtualTokenReserves,
  };
}
