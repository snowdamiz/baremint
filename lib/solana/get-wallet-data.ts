import { db } from "@/lib/db";
import { wallet } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSolBalance, lamportsToSol } from "./balance";
import { getSolUsdPrice } from "./price";

export interface WalletData {
  publicKey: string;
  solBalance: number;
  usdBalance: number;
}

/**
 * Fetch complete wallet data for a user: address, SOL balance, USD value.
 * Returns null if the user has no wallet.
 */
export async function getWalletData(
  userId: string,
): Promise<WalletData | null> {
  const userWallet = await db.query.wallet.findFirst({
    where: eq(wallet.userId, userId),
  });

  if (!userWallet) {
    return null;
  }

  const [lamports, solPrice] = await Promise.all([
    getSolBalance(userWallet.publicKey),
    getSolUsdPrice(),
  ]);

  const solBalance = lamportsToSol(lamports);
  const usdBalance = solBalance * solPrice;

  return {
    publicKey: userWallet.publicKey,
    solBalance,
    usdBalance,
  };
}
