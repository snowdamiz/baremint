import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { wallet, savedAddress } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSolBalance, lamportsToSol } from "@/lib/solana/balance";
import { getSolUsdPrice } from "@/lib/solana/price";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { WithdrawForm } from "@/components/withdraw/withdraw-form";

export default async function WithdrawPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth");
  }

  const twoFactorEnabled = session.user.twoFactorEnabled ?? false;

  // Get wallet data
  const userWallet = await db.query.wallet.findFirst({
    where: eq(wallet.userId, session.user.id),
  });

  if (!userWallet) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Withdraw SOL</h1>
        <Alert>
          <AlertDescription>
            No wallet found. Please contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const [lamports, solPrice, addresses] = await Promise.all([
    getSolBalance(userWallet.publicKey),
    getSolUsdPrice(),
    db.query.savedAddress.findMany({
      where: eq(savedAddress.userId, session.user.id),
      orderBy: (sa, { asc }) => [asc(sa.label)],
    }),
  ]);

  const solBalance = lamportsToSol(lamports);
  const usdBalance = solBalance * solPrice;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Withdraw SOL</h1>
        <p className="text-muted-foreground mt-1">
          Send SOL to an external Solana address
        </p>
      </div>

      {!twoFactorEnabled && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Two-factor authentication is required before you can withdraw. Please{" "}
            <a
              href="/dashboard/settings"
              className="font-medium underline underline-offset-4"
            >
              enable 2FA in settings
            </a>{" "}
            first.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">Available Balance</p>
        <p className="text-2xl font-bold">{solBalance.toFixed(4)} SOL</p>
        <p className="text-sm text-muted-foreground">
          ~${usdBalance.toFixed(2)} USD
        </p>
      </div>

      {twoFactorEnabled && (
        <WithdrawForm
          maxSol={solBalance}
          solPrice={solPrice}
          savedAddresses={addresses.map((a) => ({
            id: a.id,
            address: a.address,
            label: a.label,
          }))}
        />
      )}
    </div>
  );
}
