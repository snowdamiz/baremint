import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to Baremint
        </h1>
        <p className="text-muted-foreground mt-1">
          Signed in as {session.user.email}
        </p>
      </div>

      <div className="rounded-lg border p-6 space-y-3">
        <h2 className="text-lg font-semibold">Your Account</h2>
        <div className="text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">Name:</span>{" "}
            {session.user.name}
          </p>
          <p>
            <span className="text-muted-foreground">Email:</span>{" "}
            {session.user.email}
          </p>
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}
