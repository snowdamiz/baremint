import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ModerationQueue } from "@/components/admin/moderation-queue";

function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS ?? "";
  const list = adminEmails.split(",").map((e) => e.trim().toLowerCase());
  return list.includes(email.toLowerCase());
}

export default async function ModerationPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !isAdmin(session.user.email)) {
    redirect("/dashboard");
  }

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content Moderation</h1>
        <p className="text-muted-foreground mt-1">
          Review flagged content and take action
        </p>
      </div>
      <ModerationQueue />
    </div>
  );
}
