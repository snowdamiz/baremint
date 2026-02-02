"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { searchCreators } from "@/lib/discovery/search-actions";
import type { SearchResult } from "@/lib/discovery/search-actions";
import { CreatorSearchResults } from "@/components/discovery/creator-search-results";

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const trimmed = value.trim();
      if (!trimmed) {
        setResults([]);
        setHasSearched(false);
        return;
      }

      timeoutRef.current = setTimeout(() => {
        startTransition(async () => {
          const data = await searchCreators(trimmed);
          setResults(data);
          setHasSearched(true);
        });
      }, 300);
    },
    [startTransition],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Discover Creators</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search by name, bio, or category
        </p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search creators..."
          className="w-full rounded-lg border bg-background py-2.5 pl-10 pr-4 text-sm outline-none ring-ring focus:ring-2"
        />
      </div>

      {/* Loading / Results */}
      <div className={isPending ? "opacity-50 transition-opacity" : ""}>
        <CreatorSearchResults results={results} hasSearched={hasSearched} />
      </div>
    </div>
  );
}
