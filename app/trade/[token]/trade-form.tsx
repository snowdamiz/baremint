"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Settings2, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { getQuote, executeBuy, executeSell, getHoldings, type HoldingsData } from "./actions";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface TradeFormProps {
  mintAddress: string;
  tokenName: string;
  tickerSymbol: string;
  initialCurveData: {
    virtualSolReserves: string;
    virtualTokenReserves: string;
    realSolReserves: string;
    realTokenReserves: string;
    tokenTotalSupply: string;
  };
  feeBps: number;
  userSolBalance: string | null;
  userTokenBalance: string | null;
}

interface QuoteData {
  pricePerToken: string;
  priceImpactBps: number;
  // Buy fields
  tokensOut?: string;
  totalFee?: string;
  platformFee?: string;
  creatorFee?: string;
  solIntoCurve?: string;
  // Sell fields
  netSol?: string;
  grossSol?: string;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const LAMPORTS_PER_SOL = 1_000_000_000;
const TOKEN_DECIMALS = 9;

function solToLamports(sol: string): string {
  const parts = sol.split(".");
  const whole = parts[0] || "0";
  let frac = parts[1] || "";
  frac = frac.padEnd(9, "0").slice(0, 9);
  return (BigInt(whole) * BigInt(LAMPORTS_PER_SOL) + BigInt(frac)).toString();
}

function tokensToRaw(tokens: string): string {
  const parts = tokens.split(".");
  const whole = parts[0] || "0";
  let frac = parts[1] || "";
  frac = frac.padEnd(TOKEN_DECIMALS, "0").slice(0, TOKEN_DECIMALS);
  return (
    BigInt(whole) * BigInt(10 ** TOKEN_DECIMALS) + BigInt(frac)
  ).toString();
}

function lamportsToSol(lamports: string): string {
  const val = BigInt(lamports);
  const whole = val / BigInt(LAMPORTS_PER_SOL);
  const frac = val % BigInt(LAMPORTS_PER_SOL);
  const fracStr = frac.toString().padStart(9, "0");
  // Trim trailing zeros but keep at least 2 decimal places
  const trimmed = fracStr.replace(/0+$/, "");
  const display = trimmed.length < 2 ? fracStr.slice(0, 2) : trimmed;
  return `${whole}.${display}`;
}

function rawToTokens(raw: string): string {
  const val = BigInt(raw);
  const whole = val / BigInt(10 ** TOKEN_DECIMALS);
  const frac = val % BigInt(10 ** TOKEN_DECIMALS);
  const fracStr = frac.toString().padStart(TOKEN_DECIMALS, "0");
  const trimmed = fracStr.replace(/0+$/, "");
  const display = trimmed.length < 2 ? fracStr.slice(0, 2) : trimmed;
  return `${whole}.${display}`;
}

function formatSol6(lamports: string): string {
  const val = BigInt(lamports);
  const whole = val / BigInt(LAMPORTS_PER_SOL);
  const frac = val % BigInt(LAMPORTS_PER_SOL);
  return `${whole}.${frac.toString().padStart(9, "0").slice(0, 6)}`;
}

const SLIPPAGE_PRESETS = [
  { label: "0.5%", value: 50 },
  { label: "1%", value: 100 },
  { label: "2%", value: 200 },
];

const QUICK_AMOUNTS = [
  { label: "25%", factor: 0.25 },
  { label: "50%", factor: 0.5 },
  { label: "75%", factor: 0.75 },
  { label: "MAX", factor: 1 },
];

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function TradeForm({
  mintAddress,
  tokenName,
  tickerSymbol,
  initialCurveData,
  feeBps,
  userSolBalance,
  userTokenBalance,
}: TradeFormProps) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(100); // default 1%
  const [customSlippage, setCustomSlippage] = useState("");
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holdings, setHoldings] = useState<HoldingsData | null>(null);

  // Fetch quote on debounced amount change
  const fetchQuote = useCallback(
    async (inputAmount: string) => {
      if (!inputAmount || parseFloat(inputAmount) <= 0) {
        setQuote(null);
        return;
      }

      setQuoteLoading(true);
      try {
        const rawAmount =
          side === "buy"
            ? solToLamports(inputAmount)
            : tokensToRaw(inputAmount);

        const result = await getQuote(mintAddress, side, rawAmount);
        if (result.success) {
          setQuote(result.data as QuoteData);
        } else {
          setQuote(null);
        }
      } catch {
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    },
    [mintAddress, side],
  );

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchQuote(amount);
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [amount, fetchQuote]);

  // Reset amount when switching sides
  useEffect(() => {
    setAmount("");
    setQuote(null);
  }, [side]);

  // Fetch holdings P&L on mount
  useEffect(() => {
    getHoldings(mintAddress).then(setHoldings).catch(() => setHoldings(null));
  }, [mintAddress]);

  const handleAmountChange = (value: string) => {
    // Only allow numeric input with optional decimal
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleQuickAmount = (factor: number) => {
    const balance = side === "buy" ? userSolBalance : userTokenBalance;
    if (!balance) return;

    const balBig = BigInt(balance);
    const scaled = (balBig * BigInt(Math.round(factor * 10000))) / BigInt(10000);

    if (side === "buy") {
      setAmount(lamportsToSol(scaled.toString()));
    } else {
      setAmount(rawToTokens(scaled.toString()));
    }
  };

  const handleSlippagePreset = (bps: number) => {
    setSlippageBps(bps);
    setCustomSlippage("");
  };

  const handleCustomSlippage = (value: string) => {
    setCustomSlippage(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
      setSlippageBps(Math.round(parsed * 100));
    }
  };

  const isLargeTrade = (() => {
    if (!amount || parseFloat(amount) <= 0) return false;
    if (side === "buy") {
      return parseFloat(amount) >= 0.1;
    }
    // For sells, check if the estimated SOL out >= 0.1
    if (quote?.netSol) {
      return BigInt(quote.netSol) >= BigInt(LAMPORTS_PER_SOL / 10);
    }
    return false;
  })();

  const handleSubmit = () => {
    if (isLargeTrade) {
      setShowReview(true);
    } else {
      executeTradeAction();
    }
  };

  const executeTradeAction = () => {
    setShowReview(false);
    startTransition(async () => {
      try {
        if (side === "buy") {
          const rawSol = solToLamports(amount);
          const result = await executeBuy(mintAddress, rawSol, slippageBps);
          if (result.success) {
            const sig = result.signature!;
            const truncatedSig = `${sig.slice(0, 8)}...${sig.slice(-8)}`;
            toast.success("Trade submitted!", {
              description: `Bought ${rawToTokens(result.estimate!.tokensOut)} ${tickerSymbol}`,
              action: {
                label: `${truncatedSig}`,
                onClick: () =>
                  window.open(
                    `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
                    "_blank",
                  ),
              },
            });
            setAmount("");
            setQuote(null);
          } else {
            toast.error("Trade failed", {
              description: result.error,
            });
          }
        } else {
          const rawTokens = tokensToRaw(amount);
          const result = await executeSell(
            mintAddress,
            rawTokens,
            slippageBps,
          );
          if (result.success) {
            const sig = result.signature!;
            const truncatedSig = `${sig.slice(0, 8)}...${sig.slice(-8)}`;
            toast.success("Trade submitted!", {
              description: `Sold for ${lamportsToSol(result.estimate!.netSol)} SOL`,
              action: {
                label: `${truncatedSig}`,
                onClick: () =>
                  window.open(
                    `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
                    "_blank",
                  ),
              },
            });
            setAmount("");
            setQuote(null);
          } else {
            toast.error("Trade failed", {
              description: result.error,
            });
          }
        }
      } catch (error) {
        toast.error("Trade failed", {
          description:
            error instanceof Error ? error.message : "Unexpected error",
        });
      }
    });
  };

  const priceImpactColor =
    quote && quote.priceImpactBps > 500
      ? "text-destructive"
      : quote && quote.priceImpactBps > 100
        ? "text-yellow-500"
        : "text-green-500";

  const canSubmit =
    amount && parseFloat(amount) > 0 && !quoteLoading && !isPending;

  return (
    <div className="space-y-4">
      <Card className="gap-0 py-0 overflow-hidden">
        <CardContent className="p-0">
          <Tabs
            value={side}
            onValueChange={(v) => setSide(v as "buy" | "sell")}
          >
            {/* Tab header with slippage gear */}
            <div className="flex items-center justify-between border-b px-4 pt-3 pb-0">
              <TabsList className="h-auto bg-transparent p-0">
                <TabsTrigger
                  value="buy"
                  className="rounded-none border-b-2 border-transparent px-4 pb-2.5 data-[state=active]:border-green-500 data-[state=active]:text-green-500 data-[state=active]:shadow-none"
                >
                  Buy
                </TabsTrigger>
                <TabsTrigger
                  value="sell"
                  className="rounded-none border-b-2 border-transparent px-4 pb-2.5 data-[state=active]:border-red-500 data-[state=active]:text-red-500 data-[state=active]:shadow-none"
                >
                  Sell
                </TabsTrigger>
              </TabsList>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="mb-1">
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Slippage Tolerance</p>
                    <div className="flex gap-2">
                      {SLIPPAGE_PRESETS.map((preset) => (
                        <Button
                          key={preset.value}
                          variant={
                            slippageBps === preset.value
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          className="flex-1"
                          onClick={() => handleSlippagePreset(preset.value)}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Custom"
                        value={customSlippage}
                        onChange={(e) =>
                          handleCustomSlippage(e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Current: {(slippageBps / 100).toFixed(1)}%
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Buy tab */}
            <TabsContent value="buy" className="p-4">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm text-muted-foreground">
                    You pay (SOL)
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="h-12 text-lg font-medium"
                  />
                  {/* Quick amount buttons */}
                  <div className="mt-2 flex gap-2">
                    {QUICK_AMOUNTS.map((qa) => (
                      <Button
                        key={qa.label}
                        variant="outline"
                        size="xs"
                        className="flex-1"
                        disabled={!userSolBalance}
                        onClick={() => handleQuickAmount(qa.factor)}
                      >
                        {qa.label}
                      </Button>
                    ))}
                  </div>
                  {userSolBalance && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Balance: {lamportsToSol(userSolBalance)} SOL
                    </p>
                  )}
                </div>

                {/* Quote preview */}
                <QuotePreview
                  side="buy"
                  quote={quote}
                  loading={quoteLoading}
                  tickerSymbol={tickerSymbol}
                  priceImpactColor={priceImpactColor}
                />

                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    `Buy ${tickerSymbol}`
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Sell tab */}
            <TabsContent value="sell" className="p-4">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm text-muted-foreground">
                    You sell ({tickerSymbol})
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="h-12 text-lg font-medium"
                  />
                  {/* Quick amount buttons */}
                  <div className="mt-2 flex gap-2">
                    {QUICK_AMOUNTS.map((qa) => (
                      <Button
                        key={qa.label}
                        variant="outline"
                        size="xs"
                        className="flex-1"
                        disabled={!userTokenBalance}
                        onClick={() => handleQuickAmount(qa.factor)}
                      >
                        {qa.label}
                      </Button>
                    ))}
                  </div>
                  {userTokenBalance && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Balance: {rawToTokens(userTokenBalance)} {tickerSymbol}
                    </p>
                  )}
                </div>

                {/* Quote preview */}
                <QuotePreview
                  side="sell"
                  quote={quote}
                  loading={quoteLoading}
                  tickerSymbol={tickerSymbol}
                  priceImpactColor={priceImpactColor}
                />

                <Button
                  className="w-full bg-red-600 hover:bg-red-700"
                  size="lg"
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    `Sell ${tickerSymbol}`
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Holdings card with P&L */}
      {holdings && (
        <HoldingsCard
          holdings={holdings}
          tickerSymbol={tickerSymbol}
        />
      )}

      {/* Review dialog for large trades */}
      <Dialog open={showReview} onOpenChange={setShowReview}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Trade</DialogTitle>
            <DialogDescription>
              Please review the details before confirming.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium capitalize">{side}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {side === "buy" ? "You pay" : "You sell"}
              </span>
              <span className="font-medium">
                {amount} {side === "buy" ? "SOL" : tickerSymbol}
              </span>
            </div>
            {quote && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">You receive</span>
                  <span className="font-medium">
                    ~
                    {side === "buy"
                      ? `${rawToTokens(quote.tokensOut || "0")} ${tickerSymbol}`
                      : `${lamportsToSol(quote.netSol || "0")} SOL`}
                  </span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Platform fee</span>
                    <span>{formatSol6(quote.platformFee || "0")} SOL</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Creator fee</span>
                    <span>{formatSol6(quote.creatorFee || "0")} SOL</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-muted-foreground">Total fee</span>
                    <span>{formatSol6(quote.totalFee || "0")} SOL</span>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price impact</span>
                  <span className={priceImpactColor}>
                    {(quote.priceImpactBps / 100).toFixed(2)}%
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Slippage tolerance</span>
              <span>{(slippageBps / 100).toFixed(1)}%</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReview(false)}>
              Cancel
            </Button>
            <Button
              className={
                side === "buy"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
              onClick={executeTradeAction}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirm Trade"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ──────────────────────────────────────────────
// Quote Preview sub-component
// ──────────────────────────────────────────────

function QuotePreview({
  side,
  quote,
  loading,
  tickerSymbol,
  priceImpactColor,
}: {
  side: "buy" | "sell";
  quote: QuoteData | null;
  loading: boolean;
  tickerSymbol: string;
  priceImpactColor: string;
}) {
  if (!quote && !loading) return null;

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      {/* Amount out */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">You receive</span>
        {loading ? (
          <span className="h-4 w-20 animate-pulse rounded bg-muted" />
        ) : quote ? (
          <span className="font-medium">
            ~
            {side === "buy"
              ? `${rawToTokens(quote.tokensOut || "0")} ${tickerSymbol}`
              : `${lamportsToSol(quote.netSol || "0")} SOL`}
          </span>
        ) : null}
      </div>

      {/* Fee breakdown */}
      {loading ? (
        <div className="space-y-1.5">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      ) : quote ? (
        <>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Platform fee</span>
            <span>{formatSol6(quote.platformFee || "0")} SOL</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Creator fee</span>
            <span>{formatSol6(quote.creatorFee || "0")} SOL</span>
          </div>
          <div className="flex justify-between text-xs font-medium">
            <span>Total fee</span>
            <span>{formatSol6(quote.totalFee || "0")} SOL</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Price impact</span>
            <span className={priceImpactColor}>
              {(quote.priceImpactBps / 100).toFixed(2)}%
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ──────────────────────────────────────────────
// Holdings Card sub-component
// ──────────────────────────────────────────────

function HoldingsCard({
  holdings,
  tickerSymbol,
}: {
  holdings: HoldingsData;
  tickerSymbol: string;
}) {
  const pnlNum = Number(holdings.pnlPercent);
  const isPositive = pnlNum >= 0;
  const unrealizedLamports = BigInt(holdings.unrealizedPnl);
  const isNegative = unrealizedLamports < BigInt(0);
  const absUnrealized = isNegative ? -unrealizedLamports : unrealizedLamports;

  // Format SOL values from lamports
  const formatLamports = (lamports: string) => {
    const val = BigInt(lamports);
    const abs = val < BigInt(0) ? -val : val;
    const whole = abs / BigInt(LAMPORTS_PER_SOL);
    const frac = abs % BigInt(LAMPORTS_PER_SOL);
    const fracStr = frac.toString().padStart(9, "0").slice(0, 4);
    return `${val < BigInt(0) ? "-" : ""}${whole}.${fracStr}`;
  };

  // Format avg buy price from rational string (num/denom)
  const formatAvgPrice = (rational: string) => {
    if (!rational.includes("/")) return rational;
    const [num, denom] = rational.split("/");
    const n = Number(num);
    const d = Number(denom);
    if (d === 0) return "--";
    const price = (n / d / LAMPORTS_PER_SOL) * 10 ** TOKEN_DECIMALS;
    if (price < 0.000001) return price.toExponential(2);
    return price.toFixed(6);
  };

  return (
    <Card className="gap-2 py-3">
      <CardContent>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            Your Holdings
          </p>
          <div
            className={`flex items-center gap-1 text-xs font-medium ${
              isPositive ? "text-green-500" : "text-red-500"
            }`}
          >
            {isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {isPositive ? "+" : ""}
            {holdings.pnlPercent}%
          </div>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <p className="text-lg font-semibold">
            {rawToTokens(holdings.netTokens)} {tickerSymbol}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatLamports(holdings.currentValueSol)} SOL
          </p>
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>Avg buy: {formatAvgPrice(holdings.avgBuyPrice)} SOL</span>
          <span
            className={isPositive ? "text-green-500" : "text-red-500"}
          >
            {isNegative ? "-" : "+"}
            {formatLamports(absUnrealized.toString())} SOL
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
