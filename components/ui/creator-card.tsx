import { Button } from "@/components/ui/button";

interface CreatorCardProps {
    name: string;
    handle: string;
    avatar: string;
    bio: string;
    subscriberCount: number;
    postCount: number;
}

export function CreatorCard({
    name,
    handle,
    avatar,
    bio,
    subscriberCount,
    postCount,
}: CreatorCardProps) {
    const formatCount = (count: number): string => {
        if (count >= 1000) {
            return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}K`;
        }
        return count.toString();
    };

    return (
        <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
            {/* Avatar */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 font-semibold text-primary-foreground">
                {avatar}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{name}</p>
                        <p className="text-xs text-muted-foreground truncate">{handle}</p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0">
                        Subscribe
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {bio}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{formatCount(subscriberCount)} subscribers</span>
                    <span>·</span>
                    <span>{postCount} posts</span>
                </div>
            </div>
        </div>
    );
}
