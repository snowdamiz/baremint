"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { CreatorBrowseCard } from "@/components/discovery/creator-browse-card";
import {
  getCreatorBrowseFeed,
  type CreatorBrowseItem,
} from "@/lib/discovery/browse-actions";

export function LoadMoreCreators({
  initialOffset,
}: {
  initialOffset: number;
}) {
  const [creators, setCreators] = useState<CreatorBrowseItem[]>([]);
  const [offset, setOffset] = useState(initialOffset);
  const [hasMore, setHasMore] = useState(true);
  const [isPending, startTransition] = useTransition();

  function loadMore() {
    startTransition(async () => {
      const result = await getCreatorBrowseFeed(20, offset);
      setCreators((prev) => [...prev, ...result.creators]);
      setOffset((prev) => prev + result.creators.length);
      setHasMore(result.hasMore);
    });
  }

  return (
    <>
      {creators.map((creator) => (
        <CreatorBrowseCard key={creator.id} creator={creator} />
      ))}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </>
  );
}
