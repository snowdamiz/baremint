import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { account } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { SecuritySettings } from "./security-settings";

export default async function SettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth");
  }

  const twoFactorEnabled = session.user.twoFactorEnabled ?? false;

  // Check if user has a password (credential account)
  const credentialAccount = await db.query.account.findFirst({
    where: and(
      eq(account.userId, session.user.id),
      eq(account.providerId, "credential"),
    ),
  });

  const hasPassword = !!credentialAccount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and security
        </p>
      </div>

      <SecuritySettings
        twoFactorEnabled={twoFactorEnabled}
        hasPassword={hasPassword}
      />
    </div>
  );
}
