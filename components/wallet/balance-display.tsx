interface BalanceDisplayProps {
  usdBalance: number;
  solBalance: number;
}

export function BalanceDisplay({ usdBalance, solBalance }: BalanceDisplayProps) {
  const formattedUsd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usdBalance);

  const formattedSol =
    solBalance === 0
      ? "0"
      : solBalance < 0.001
        ? solBalance.toFixed(6)
        : solBalance.toFixed(4);

  const isEmpty = solBalance === 0;

  return (
    <div className="space-y-1">
      <p className="text-2xl font-bold tracking-tight">{formattedUsd}</p>
      <p className="text-muted-foreground text-sm">{formattedSol} SOL</p>
      {isEmpty && (
        <p className="text-muted-foreground mt-2 text-xs">
          Your wallet is empty. Fund it with SOL to get started.
        </p>
      )}
    </div>
  );
}
