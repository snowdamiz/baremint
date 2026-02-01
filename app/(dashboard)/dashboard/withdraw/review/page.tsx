import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ReviewCard } from "@/components/withdraw/review-card";

interface ReviewPageProps {
  searchParams: Promise<{
    to?: string;
    amount?: string;
    sol?: string;
    usd?: string;
  }>;
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth");
  }

  if (!session.user.twoFactorEnabled) {
    redirect("/dashboard/settings");
  }

  const params = await searchParams;
  const { to, amount, sol, usd } = params;

  if (!to || !amount || !sol || !usd) {
    redirect("/dashboard/withdraw");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Review Withdrawal</h1>
        <p className="text-muted-foreground mt-1">
          Confirm the details below and enter your 2FA code to proceed
        </p>
      </div>

      <ReviewCard
        toAddress={to}
        amountLamports={amount}
        solDisplay={sol}
        usdDisplay={usd}
      />
    </div>
  );
}
