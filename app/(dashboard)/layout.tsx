import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getWalletData } from "@/lib/solana/get-wallet-data";
import { WalletWidget } from "@/components/wallet/wallet-widget";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth");
  }

  const walletData = await getWalletData(session.user.id);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-lg font-semibold">Baremint</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <a
            href="/dashboard"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium bg-sidebar-accent text-sidebar-accent-foreground"
          >
            Dashboard
          </a>
          <a
            href="/dashboard/withdraw"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            Withdraw
          </a>
          <a
            href="/dashboard/settings"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            Settings
          </a>
        </nav>
        {walletData && (
          <div className="border-t p-4">
            <WalletWidget
              publicKey={walletData.publicKey}
              solBalance={walletData.solBalance}
              usdBalance={walletData.usdBalance}
            />
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1">
        <div className="flex h-14 items-center border-b px-6 md:hidden">
          <span className="text-lg font-semibold">Baremint</span>
        </div>
        <div className="p-6">
          {/* Mobile wallet widget */}
          {walletData && (
            <div className="mb-6 md:hidden">
              <WalletWidget
                publicKey={walletData.publicKey}
                solBalance={walletData.solBalance}
                usdBalance={walletData.usdBalance}
              />
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
