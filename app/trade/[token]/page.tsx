import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { creatorToken, creatorProfile, wallet } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  readBondingCurveAccount,
  readGlobalConfig,
} from "@/lib/solana/bonding-curve-read";
import { TokenStats } from "./token-stats";
import { TradeForm } from "./trade-form";
import { TradeHistory } from "./trade-history";
import { PriceChart } from "./price-chart";
import { CurveViz } from "./curve-viz";
import { TipDialog } from "@/components/donate/tip-dialog";

interface TradePageProps {
  params: Promise<{ token: string }>;
}

export default async function TradePage({ params }: TradePageProps) {
  const { token: mintAddress } = await params;

  // Load token + creator data from DB
  const tokenData = await db.query.creatorToken.findFirst({
    where: eq(creatorToken.mintAddress, mintAddress),
  });

  if (!tokenData) {
    notFound();
  }

  // Load creator profile
  const creator = await db.query.creatorProfile.findFirst({
    where: eq(creatorProfile.id, tokenData.creatorProfileId),
  });

  if (!creator) {
    notFound();
  }

  // Load on-chain data
  let bondingCurve;
  let globalConfig;
  try {
    [bondingCurve, globalConfig] = await Promise.all([
      readBondingCurveAccount(mintAddress),
      readGlobalConfig(),
    ]);
  } catch {
    // If on-chain data unavailable, show page with error state
    notFound();
  }

  // Load user session (optional - page works for unauthenticated viewing)
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Get user's SOL balance and token balance if authenticated
  let userSolBalance: string | null = null;
  let userTokenBalance: string | null = null;

  if (session) {
    const userWallet = await db.query.wallet.findFirst({
      where: eq(wallet.userId, session.user.id),
    });

    if (userWallet) {
      // TODO: Fetch actual SOL balance from RPC
      // For now, leave null (form will handle gracefully)
      userSolBalance = null;
      userTokenBalance = null;
    }
  }

  // Check if viewer is the creator (don't show tip button for self)
  const isCreator = session?.user?.id === creator.userId;

  // Serialize BigInt values for client components
  const curveData = {
    virtualSolReserves: bondingCurve.virtualSolReserves.toString(),
    virtualTokenReserves: bondingCurve.virtualTokenReserves.toString(),
    realSolReserves: bondingCurve.realSolReserves.toString(),
    realTokenReserves: bondingCurve.realTokenReserves.toString(),
    tokenTotalSupply: bondingCurve.tokenTotalSupply.toString(),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Left column: Token stats + chart placeholder + history placeholder */}
        <div className="space-y-6">
          <TokenStats
            tokenName={tokenData.tokenName}
            tickerSymbol={tokenData.tickerSymbol}
            creatorDisplayName={creator.displayName}
            creatorAvatarUrl={creator.avatarUrl}
            creatorProfileId={creator.id}
            virtualSolReserves={curveData.virtualSolReserves}
            virtualTokenReserves={curveData.virtualTokenReserves}
            realTokenReserves={curveData.realTokenReserves}
            tokenTotalSupply={curveData.tokenTotalSupply}
          />

          {/* Price chart */}
          <PriceChart mintAddress={mintAddress} />

          {/* Bonding curve visualization */}
          <CurveViz
            virtualSolReserves={curveData.virtualSolReserves}
            virtualTokenReserves={curveData.virtualTokenReserves}
            realSolReserves={curveData.realSolReserves}
            realTokenReserves={curveData.realTokenReserves}
            tokenTotalSupply={curveData.tokenTotalSupply}
          />

          {/* Trade history */}
          <TradeHistory
            mintAddress={mintAddress}
            tickerSymbol={tokenData.tickerSymbol}
          />
        </div>

        {/* Right column: Trade form + tip */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <TradeForm
            mintAddress={mintAddress}
            tokenName={tokenData.tokenName}
            tickerSymbol={tokenData.tickerSymbol}
            initialCurveData={curveData}
            feeBps={globalConfig.feeBps}
            userSolBalance={userSolBalance}
            userTokenBalance={userTokenBalance}
          />
          {session && !isCreator && (
            <TipDialog
              creatorName={creator.displayName}
              mintAddress={mintAddress}
              tokenTicker={tokenData.tickerSymbol}
            />
          )}
        </div>
      </div>
    </div>
  );
}
