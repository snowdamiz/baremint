import { DollarSign } from "lucide-react";

interface WalletWidgetProps {
  publicKey: string;
  solBalance: number;
  usdBalance: number;
}

export function WalletWidget({
  usdBalance,
}: WalletWidgetProps) {
  const formattedBalance = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usdBalance);

  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
        <DollarSign className="h-4 w-4 text-success" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Balance</p>
        <p className="font-semibold">{formattedBalance}</p>
      </div>
    </div>
  );
}
