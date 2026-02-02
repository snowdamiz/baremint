import { Trophy } from "lucide-react";
import { getLeaderboard } from "@/lib/discovery/leaderboard-actions";
import { LeaderboardTable } from "@/components/discovery/leaderboard-table";

export default async function LeaderboardPage() {
  const { tokens, hasMore } = await getLeaderboard("volume_24h", 50, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Leaderboard</h1>
      </div>

      <LeaderboardTable initialTokens={tokens} initialHasMore={hasMore} />
    </div>
  );
}
