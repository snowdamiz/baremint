import { Card, CardContent } from "@/components/ui/card";
import { BalanceDisplay } from "./balance-display";
import { AddressDisplay } from "./address-display";
import { Wallet } from "lucide-react";

interface WalletWidgetProps {
  publicKey: string;
  solBalance: number;
  usdBalance: number;
}

export function WalletWidget({
  publicKey,
  solBalance,
  usdBalance,
}: WalletWidgetProps) {
  return (
    <Card className="gap-4 py-4">
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Wallet className="text-muted-foreground h-4 w-4" />
          <span className="text-sm font-medium">Wallet</span>
        </div>
        <BalanceDisplay usdBalance={usdBalance} solBalance={solBalance} />
        <AddressDisplay address={publicKey} />
      </CardContent>
    </Card>
  );
}
