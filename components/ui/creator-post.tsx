import { Heart, MessageCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatorPostProps {
    creator: {
        name: string;
        handle: string;
        avatar: string;
    };
    content: string;
    isLocked?: boolean;
    likesCount?: number;
    commentsCount?: number;
    timestamp: string;
}

export function CreatorPost({
    creator,
    content,
    isLocked,
    likesCount,
    commentsCount,
    timestamp,
}: CreatorPostProps) {
    return (
        <div className="rounded-xl border bg-card p-4 shadow-card">
            {/* Creator Header */}
            <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 font-semibold text-primary-foreground text-sm">
                    {creator.avatar}
                </div>
                <div className="flex-1">
                    <p className="font-medium text-sm">{creator.name}</p>
                    <p className="text-xs text-muted-foreground">
                        {creator.handle} · {timestamp}
                    </p>
                </div>
            </div>

            {/* Content */}
            {isLocked ? (
                <div className="relative">
                    <div className="rounded-lg bg-gradient-to-br from-accent to-secondary p-8 flex flex-col items-center justify-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                            <Lock className="h-6 w-6 text-primary" />
                        </div>
                        <p className="text-sm font-medium">Subscribe to view</p>
                        <p className="text-xs text-muted-foreground text-center max-w-[200px]">
                            This content is only available to subscribers
                        </p>
                    </div>
                </div>
            ) : (
                <p className="text-sm leading-relaxed">{content}</p>
            )}

            {/* Actions */}
            {!isLocked && (
                <div className="flex items-center gap-4 mt-4 pt-3 border-t">
                    <button className={cn(
                        "flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors",
                        "text-sm"
                    )}>
                        <Heart className="h-4 w-4" />
                        {likesCount && <span>{likesCount}</span>}
                    </button>
                    <button className={cn(
                        "flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors",
                        "text-sm"
                    )}>
                        <MessageCircle className="h-4 w-4" />
                        {commentsCount && <span>{commentsCount}</span>}
                    </button>
                </div>
            )}
        </div>
    );
}
