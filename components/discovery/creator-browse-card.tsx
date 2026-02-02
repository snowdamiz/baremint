import Image from "next/image";
import Link from "next/link";
import type { CreatorBrowseItem } from "@/lib/discovery/browse-actions";

export function CreatorBrowseCard({
  creator,
}: {
  creator: CreatorBrowseItem;
}) {
  return (
    <Link
      href={`/trade/${creator.mintAddress}`}
      className="block rounded-xl border bg-card p-4 shadow-card transition-colors hover:bg-accent/50"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {creator.avatarUrl ? (
          <Image
            src={creator.avatarUrl}
            alt={creator.displayName}
            width={48}
            height={48}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-lg font-semibold text-primary-foreground">
            {creator.displayName.charAt(0)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          {/* Name + Category */}
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{creator.displayName}</h3>
            {creator.category && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {creator.category}
              </span>
            )}
          </div>

          {/* Bio */}
          {creator.bio && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {creator.bio}
            </p>
          )}

          {/* Token info */}
          <div className="mt-2 flex items-center gap-1.5">
            {creator.tokenImageUrl && (
              <Image
                src={creator.tokenImageUrl}
                alt={creator.tickerSymbol}
                width={16}
                height={16}
                className="h-4 w-4 rounded-full"
              />
            )}
            <span className="text-xs font-medium text-muted-foreground">
              ${creator.tickerSymbol}
            </span>
            <span className="text-xs text-muted-foreground/60">
              {creator.tokenName}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
