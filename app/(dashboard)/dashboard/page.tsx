import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "./sign-out-button";
import { getCreatorBrowseFeed } from "@/lib/discovery/browse-actions";
import { CreatorBrowseCard } from "@/components/discovery/creator-browse-card";
import { LoadMoreCreators } from "./load-more-creators";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth");
  }

  const { creators, hasMore } = await getCreatorBrowseFeed(20, 0);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Hey, {session.user.name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Discover creators and support them with tokens
        </p>
      </div>

      {/* Creator Browse Feed */}
      {creators.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center shadow-card">
          <p className="text-muted-foreground">
            No creators yet. Be the first to launch a token!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Creators
          </h2>
          <div className="space-y-3">
            {creators.map((creator) => (
              <CreatorBrowseCard key={creator.id} creator={creator} />
            ))}
          </div>
          {hasMore && <LoadMoreCreators initialOffset={20} />}
        </div>
      )}

      {/* Account Section */}
      <div className="rounded-xl border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 font-semibold text-primary-foreground">
              {session.user.name?.charAt(0) || "U"}
            </div>
            <div>
              <p className="font-medium">{session.user.name}</p>
              <p className="text-xs text-muted-foreground">{session.user.email}</p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
