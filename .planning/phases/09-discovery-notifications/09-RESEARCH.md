# Phase 9: Discovery & Notifications - Research

**Researched:** 2026-02-01
**Domain:** Creator discovery (browse, search, leaderboard) + in-app notification system
**Confidence:** HIGH

## Summary

Phase 9 adds four features to the Baremint platform: a homepage creator browse feed, full-text search over creators, a token leaderboard with market cap and volume rankings, and an in-app notification system for content and trade activity. The codebase already has all the foundational infrastructure: the `creatorProfile` and `creatorToken` tables, the `trade` table with confirmed/pending status, the `post` table, and Helius webhooks for on-chain event monitoring. The dashboard layout already includes an "Explore" nav link (`/dashboard/explore`) and the homepage currently uses mock data for the feed.

The standard approach uses PostgreSQL full-text search (tsvector + GIN index) via Drizzle ORM's `sql` template for creator search, SQL aggregation of the existing `trade` table for volume/leaderboard, and a polling-based notification system backed by a new `notification` table. SSE (Server-Sent Events) was considered for real-time delivery but is inappropriate for the MVP given Vercel deployment constraints and the complexity of managing persistent connections. Simple polling with a badge counter is the pragmatic choice.

**Primary recommendation:** Use Postgres-native full-text search with generated tsvector columns on `creatorProfile`, SQL aggregation on `trade` for leaderboard metrics, and a simple database-backed notification system with client-side polling every 30 seconds.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.x (existing) | ORM for all DB operations | Already in stack |
| PostgreSQL full-text search | Built-in | Creator search by name/bio | No external dependency, GIN indexes make it fast |
| Drizzle `sql` template | Built-in | Raw SQL for tsvector/tsquery | Drizzle lacks native tsvector type, `sql` template is the official escape hatch |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.563.x (existing) | Icons for notification bell, search, leaderboard | Already in stack |
| sonner | 2.0.x (existing) | Toast notifications for new activity | Already in stack, used for transient alerts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Postgres FTS | Algolia/Meilisearch | External service, cost, operational overhead -- overkill for MVP with <10K creators |
| DB polling | Server-Sent Events (SSE) | SSE requires persistent connections, problematic on Vercel serverless, complex cleanup -- polling is simpler and sufficient for MVP |
| DB polling | WebSockets | Bi-directional not needed, even more complex than SSE, requires separate infra |
| Custom notification table | Third-party (Novu, Knock) | External dependency, cost, vendor lock-in -- simple table + polling is adequate |

**Installation:**
```bash
# No new packages needed -- all dependencies already exist in package.json
```

## Architecture Patterns

### Recommended Project Structure
```
app/
├── (dashboard)/dashboard/
│   ├── page.tsx                        # Updated: real creator browse feed (replaces mock data)
│   ├── explore/
│   │   └── page.tsx                    # Search page with search bar + results
│   ├── leaderboard/
│   │   └── page.tsx                    # Token leaderboard (market cap, volume, trending)
│   └── notifications/
│       └── page.tsx                    # Full notification list page
├── api/
│   ├── creators/
│   │   ├── browse/route.ts             # GET: paginated creator feed (newest, popular)
│   │   └── search/route.ts             # GET: full-text search over creators
│   ├── leaderboard/route.ts            # GET: token leaderboard with sorting
│   └── notifications/
│       ├── route.ts                    # GET: fetch notifications, PATCH: mark as read
│       └── count/route.ts             # GET: unread count (for badge)
components/
├── discovery/
│   ├── creator-browse-card.tsx         # Card for browse feed (avatar, name, token price, post count)
│   ├── creator-search-results.tsx      # Search results list
│   └── leaderboard-table.tsx           # Leaderboard table with sortable columns
├── notifications/
│   ├── notification-bell.tsx           # Bell icon with unread badge (in layout header)
│   ├── notification-dropdown.tsx       # Dropdown showing recent notifications
│   └── notification-item.tsx           # Single notification row
lib/
├── db/
│   └── schema.ts                       # Add: notification table, search column on creatorProfile
└── notifications/
    └── create.ts                       # Server-side helper to insert notifications
```

### Pattern 1: Full-Text Search with Generated Column
**What:** Add a generated `tsvector` column to `creatorProfile` that auto-updates from `displayName` + `bio`. Use a GIN index for fast search. Query with `to_tsquery` and prefix matching.
**When to use:** Creator search by name or bio text.
**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/guides/full-text-search-with-generated-columns
import { SQL, sql } from 'drizzle-orm';
import { customType } from 'drizzle-orm/pg-core';

// Custom tsvector type (Drizzle doesn't have native support)
const tsvector = customType<{ data: string }>({
  dataType() {
    return `tsvector`;
  },
});

// In creatorProfile table definition:
searchVector: tsvector('search_vector')
  .generatedAlwaysAs(
    (): SQL => sql`setweight(to_tsvector('simple', coalesce(${creatorProfile.displayName}, '')), 'A')
                   || setweight(to_tsvector('english', coalesce(${creatorProfile.bio}, '')), 'B')`
  ),

// GIN index in table config:
index('idx_creator_search').using('gin', sql`"search_vector"`)

// Query with prefix matching for autocomplete:
const results = await db
  .select()
  .from(creatorProfile)
  .where(sql`${creatorProfile.searchVector} @@ to_tsquery('simple', ${searchTerm + ':*'})`)
  .limit(20);
```

### Pattern 2: Leaderboard via SQL Aggregation
**What:** Compute market cap and 24h volume from existing `trade` table + on-chain bonding curve data. Market cap = spot price * circulating supply (from bonding curve). Volume = SUM(solAmount) from confirmed trades in last 24h.
**When to use:** Token leaderboard rankings.
**Example:**
```typescript
// 24h volume per token from trade table
const volumes = await db
  .select({
    creatorTokenId: trade.creatorTokenId,
    mintAddress: trade.mintAddress,
    volume24h: sql<string>`SUM(CAST(${trade.solAmount} AS NUMERIC))`,
    tradeCount24h: sql<number>`COUNT(*)`,
  })
  .from(trade)
  .where(
    and(
      eq(trade.status, 'confirmed'),
      sql`${trade.confirmedAt} > NOW() - INTERVAL '24 hours'`,
    )
  )
  .groupBy(trade.creatorTokenId, trade.mintAddress);
```

### Pattern 3: Database-Backed Notifications with Polling
**What:** A `notification` table stores all notifications. Client polls `/api/notifications/count` every 30s for the unread badge. Full notification list loaded on demand.
**When to use:** In-app notifications for content publishes and trade activity.
**Example:**
```typescript
// Notification table schema
export const notification = pgTable("notification", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  type: text("type").notNull(), // "new_content" | "trade_buy" | "trade_sell" | "token_burn"
  title: text("title").notNull(),
  body: text("body"),
  linkUrl: text("link_url"), // deep link to relevant page
  relatedCreatorProfileId: text("related_creator_profile_id"),
  relatedMintAddress: text("related_mint_address"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Index for fast unread count queries
index('idx_notification_user_unread').on(notification.userId, notification.isRead)
```

### Pattern 4: Notification Creation in Existing Webhooks
**What:** When the Helius webhook confirms a trade, also fan out notifications to holders of that token. When a post is published, notify holders of the creator's token.
**When to use:** Triggered from existing webhook handlers and post publish actions.
**Example:**
```typescript
// In the Helius webhook handler, after confirming a trade:
// Find all users who hold this token (have confirmed buy trades with net positive balance)
// Insert notification for each holder
async function notifyTokenHolders(
  mintAddress: string,
  type: "trade_buy" | "trade_sell" | "token_burn",
  excludeUserId: string, // don't notify the user who did the action
  title: string,
  body: string,
) {
  // Get distinct holders (users with confirmed buys for this token)
  const holders = await db
    .selectDistinct({ userId: trade.userId })
    .from(trade)
    .where(
      and(
        eq(trade.mintAddress, mintAddress),
        eq(trade.status, 'confirmed'),
        eq(trade.type, 'buy'),
      )
    );

  // Insert notifications in bulk
  const notifications = holders
    .filter(h => h.userId !== excludeUserId)
    .map(h => ({
      id: crypto.randomUUID(),
      userId: h.userId,
      type,
      title,
      body,
      linkUrl: `/trade/${mintAddress}`,
      relatedMintAddress: mintAddress,
      isRead: false,
    }));

  if (notifications.length > 0) {
    await db.insert(notification).values(notifications);
  }
}
```

### Anti-Patterns to Avoid
- **N+1 on-chain reads for leaderboard:** Do NOT call `readBondingCurveAccount` for every token on the leaderboard page. Batch-read via Helius or cache prices in DB.
- **SSE on Vercel serverless:** Persistent connections don't work well on serverless. Use polling instead.
- **Notification fan-out in the request path:** For tokens with many holders, fan-out should be limited (batch insert, cap at reasonable limit). Consider doing this asynchronously if holder counts grow large.
- **Full-text search without GIN index:** Without a GIN index, every search does a sequential scan -- unusable at scale.
- **Using `plainto_tsquery` for autocomplete:** It does NOT support prefix matching (`:*`). Use `to_tsquery` with manual prefix appending.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text search | Custom LIKE/ILIKE queries | PostgreSQL `tsvector` + `to_tsquery` | Stemming, ranking, prefix matching, GIN indexing all built in |
| Search input debouncing | Manual setTimeout logic | `useCallback` with 300ms debounce in a custom hook | Prevents excessive API calls during typing |
| Notification badge count | Real-time subscription | Simple polling with `setInterval` (30s) | Adequate for MVP, no infrastructure complexity |
| Leaderboard sorting | Client-side sort of all tokens | SQL ORDER BY with LIMIT/OFFSET | Server-side sorting scales; client-side breaks with pagination |
| Relative time formatting | date-fns or moment | Existing `formatRelativeTime` utility (already in trade-history.tsx) | Project decision: no date-fns dependency, simple utility already exists |

**Key insight:** PostgreSQL's built-in full-text search is remarkably capable for an MVP. External search services (Algolia, Meilisearch, Typesense) add operational complexity that isn't justified until the creator count exceeds tens of thousands.

## Common Pitfalls

### Pitfall 1: Leaderboard N+1 Problem
**What goes wrong:** Reading bonding curve account from Solana RPC for every token to compute market cap. With 100 tokens, that's 100 RPC calls per page load.
**Why it happens:** Market cap requires spot price which lives on-chain.
**How to avoid:** Cache spot prices in a `token_price_cache` column on `creatorToken` or a separate cache table. Update cache periodically (e.g., when trades happen, the webhook already fires). For the leaderboard, use the cached price rather than live RPC reads. The trade webhook already updates trade status -- extend it to also update the cached price.
**Warning signs:** Leaderboard page takes >5s to load, RPC rate limits hit.

### Pitfall 2: Search Configuration Mismatch
**What goes wrong:** Using `'english'` text search config for displayName but the name contains proper nouns that get stemmed incorrectly (e.g., "Running" stemmed to "run" won't match someone named "Running").
**Why it happens:** English stemmer is designed for common words, not proper nouns.
**How to avoid:** Use `'simple'` config for `displayName` (weight A) and `'english'` for `bio` (weight B). The `simple` config preserves exact tokens without stemming, which is correct for names.
**Warning signs:** Search for a creator's exact name returns no results.

### Pitfall 3: Notification Fan-out Explosion
**What goes wrong:** A popular creator with 10,000 holders publishes a post. The publish action now inserts 10,000 notification rows synchronously, causing the request to timeout.
**Why it happens:** Fan-out grows linearly with holder count.
**How to avoid:** Cap fan-out at a reasonable limit for MVP (e.g., 1,000 most recent holders). For the webhook-triggered notifications (trades), the fan-out is naturally smaller since only holders who have ever traded this specific token get notified. If scale demands it later, move fan-out to a background job/queue.
**Warning signs:** Post publish takes >10 seconds, database write locks.

### Pitfall 4: Polling Thundering Herd
**What goes wrong:** All connected clients poll `/api/notifications/count` at exactly the same interval, causing periodic load spikes.
**Why it happens:** Fixed-interval polling without jitter.
**How to avoid:** Add random jitter to the polling interval (e.g., 25-35 seconds instead of exactly 30). Also use HTTP cache headers to enable CDN caching of the count endpoint for a few seconds.
**Warning signs:** Periodic CPU spikes every 30 seconds in monitoring.

### Pitfall 5: Duplicate Notifications from Helius Webhooks
**What goes wrong:** Helius can deliver the same webhook multiple times. Each delivery creates duplicate notifications.
**Why it happens:** At-least-once delivery guarantee from Helius.
**How to avoid:** Deduplicate by `txSignature` in the notification creation logic. Before inserting notifications for a trade, check if notifications for that txSignature already exist.
**Warning signs:** Users see the same notification multiple times.

## Code Examples

### Creator Browse Feed Query (Server Action)
```typescript
// Source: Existing pattern from app/trade/[token]/actions.ts
"use server";

import { db } from "@/lib/db";
import { creatorProfile, creatorToken, post } from "@/lib/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export async function getCreatorBrowseFeed(limit: number, offset: number) {
  // Join creatorProfile with creatorToken (only show creators who launched tokens)
  // Order by most recently active (latest post or trade activity)
  const creators = await db
    .select({
      id: creatorProfile.id,
      displayName: creatorProfile.displayName,
      bio: creatorProfile.bio,
      avatarUrl: creatorProfile.avatarUrl,
      mintAddress: creatorToken.mintAddress,
      tickerSymbol: creatorToken.tickerSymbol,
      tokenName: creatorToken.tokenName,
      tokenImageUrl: creatorToken.imageUrl,
      createdAt: creatorProfile.createdAt,
    })
    .from(creatorProfile)
    .innerJoin(creatorToken, eq(creatorToken.creatorProfileId, creatorProfile.id))
    .where(eq(creatorProfile.kycStatus, 'approved'))
    .orderBy(desc(creatorProfile.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = creators.length > limit;
  return { creators: creators.slice(0, limit), hasMore };
}
```

### Full-Text Search Query
```typescript
// Source: https://orm.drizzle.team/docs/guides/postgresql-full-text-search
export async function searchCreators(query: string, limit: number = 20) {
  // Sanitize input: remove special characters, trim
  const sanitized = query.replace(/[^\w\s]/g, '').trim();
  if (!sanitized) return [];

  // Split into words, add prefix matching to last word for autocomplete
  const words = sanitized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  // Build tsquery: full match on all words except last, prefix on last
  const lastWord = words[words.length - 1];
  const fullWords = words.slice(0, -1);
  const tsqueryParts = [
    ...fullWords.map(w => w),
    lastWord + ':*',
  ];
  const tsquery = tsqueryParts.join(' & ');

  const results = await db
    .select({
      id: creatorProfile.id,
      displayName: creatorProfile.displayName,
      bio: creatorProfile.bio,
      avatarUrl: creatorProfile.avatarUrl,
      rank: sql<number>`ts_rank(${creatorProfile.searchVector}, to_tsquery('simple', ${tsquery}))`,
    })
    .from(creatorProfile)
    .where(sql`${creatorProfile.searchVector} @@ to_tsquery('simple', ${tsquery})`)
    .orderBy(sql`ts_rank(${creatorProfile.searchVector}, to_tsquery('simple', ${tsquery})) DESC`)
    .limit(limit);

  return results;
}
```

### Notification Count Polling Hook
```typescript
// Client-side hook for notification badge
"use client";

import { useState, useEffect, useCallback } from "react";

export function useNotificationCount() {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/count");
      if (res.ok) {
        const data = await res.json();
        setCount(data.count);
      }
    } catch {
      // Silently fail -- badge will show stale count
    }
  }, []);

  useEffect(() => {
    fetchCount();
    // Poll with jitter: 25-35 seconds
    const baseInterval = 30_000;
    const jitter = Math.random() * 10_000 - 5_000; // -5s to +5s
    const interval = setInterval(fetchCount, baseInterval + jitter);
    return () => clearInterval(interval);
  }, [fetchCount]);

  return { count, refresh: fetchCount };
}
```

### Leaderboard Query with 24h Volume
```typescript
// Source: Pattern from existing getChartData in app/trade/[token]/actions.ts
export async function getLeaderboard(
  sortBy: "market_cap" | "volume_24h" | "newest",
  limit: number,
  offset: number,
) {
  // Get 24h volume for all tokens
  const volumeSubquery = db
    .select({
      creatorTokenId: trade.creatorTokenId,
      volume24h: sql<string>`COALESCE(SUM(CAST(${trade.solAmount} AS NUMERIC)), 0)`.as('volume_24h'),
      tradeCount: sql<number>`COUNT(*)`.as('trade_count'),
    })
    .from(trade)
    .where(
      and(
        eq(trade.status, 'confirmed'),
        sql`${trade.confirmedAt} > NOW() - INTERVAL '24 hours'`,
      )
    )
    .groupBy(trade.creatorTokenId)
    .as('vol');

  // Join with creator token and profile
  const results = await db
    .select({
      tokenId: creatorToken.id,
      mintAddress: creatorToken.mintAddress,
      tokenName: creatorToken.tokenName,
      tickerSymbol: creatorToken.tickerSymbol,
      imageUrl: creatorToken.imageUrl,
      creatorName: creatorProfile.displayName,
      creatorAvatarUrl: creatorProfile.avatarUrl,
      creatorProfileId: creatorProfile.id,
      launchedAt: creatorToken.launchedAt,
      volume24h: sql<string>`COALESCE(${volumeSubquery.volume24h}, '0')`,
      tradeCount: sql<number>`COALESCE(${volumeSubquery.tradeCount}, 0)`,
    })
    .from(creatorToken)
    .innerJoin(creatorProfile, eq(creatorProfile.id, creatorToken.creatorProfileId))
    .leftJoin(volumeSubquery, eq(volumeSubquery.creatorTokenId, creatorToken.id))
    .orderBy(
      sortBy === 'volume_24h'
        ? sql`COALESCE(${volumeSubquery.volume24h}, '0') DESC`
        : sortBy === 'newest'
        ? desc(creatorToken.launchedAt)
        : sql`COALESCE(${volumeSubquery.volume24h}, '0') DESC` // market_cap sorted client-side after RPC fetch
    )
    .limit(limit + 1)
    .offset(offset);

  const hasMore = results.length > limit;
  return { tokens: results.slice(0, limit), hasMore };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LIKE '%term%' queries | Postgres `tsvector` + GIN index | Long-standing, but Drizzle guide published 2024 | 10-50x faster search, stemming, ranking |
| Generated column in migration SQL | Drizzle `generatedAlwaysAs` in schema | Drizzle 0.34+ (2024) | Can define generated columns in ORM schema, auto-generates migration |
| WebSocket for notifications | Polling or SSE | Ongoing trend for serverless | Simpler deployment, especially on Vercel |

**Deprecated/outdated:**
- `serial` columns: Drizzle now recommends `integer().generatedAlwaysAsIdentity()` but project uses `text` IDs (UUID pattern) so not relevant.

## Open Questions

1. **Market cap caching strategy**
   - What we know: Market cap requires on-chain price data (bonding curve virtual reserves). The Helius webhook fires on trades.
   - What's unclear: Whether to cache price per token in the `creatorToken` table or a separate cache table, and how frequently to refresh for non-traded tokens.
   - Recommendation: Add `cachedPriceLamports` and `cachedPriceUpdatedAt` columns to `creatorToken`. Update on every confirmed trade via the webhook handler. For leaderboard, use cached values. Accept staleness for dormant tokens.

2. **Holder determination for notifications**
   - What we know: No `tokenBalanceCache` for all users -- current cache is per-wallet per-mint, populated on demand.
   - What's unclear: Whether to use trade history (users who have bought) as a proxy for holders, or maintain a proper holder list.
   - Recommendation: Use `SELECT DISTINCT userId FROM trade WHERE mintAddress = ? AND type = 'buy' AND status = 'confirmed'` as holder proxy. This catches all users who ever bought, even if they sold later -- acceptable for MVP since over-notifying is better than missing notifications. Refine later with balance checks.

3. **Category/tag system for creators**
   - What we know: Requirements mention "search by category" but `creatorProfile` has no category field.
   - What's unclear: Whether to add categories now or defer.
   - Recommendation: Add an optional `category` text field to `creatorProfile` with a small enum of predefined categories (e.g., "Art", "Music", "Gaming", "Education", "Fitness", "Tech", "Other"). Include category in the search vector with weight C. Categories can be filtered via SQL WHERE clause.

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM - PostgreSQL full-text search guide](https://orm.drizzle.team/docs/guides/postgresql-full-text-search) - Basic FTS patterns
- [Drizzle ORM - Full-text search with generated columns](https://orm.drizzle.team/docs/guides/full-text-search-with-generated-columns) - Generated tsvector column pattern, GIN index
- [PostgreSQL Documentation: Text Search Controls](https://www.postgresql.org/docs/current/textsearch-controls.html) - Prefix matching with `:*`, `setweight`, `ts_rank`
- Existing codebase: `lib/db/schema.ts`, `app/api/webhooks/helius/route.ts`, `app/trade/[token]/actions.ts` - Current patterns for DB schema, webhook handling, SQL aggregation

### Secondary (MEDIUM confidence)
- [Neon PostgreSQL Full-Text Search Guide](https://neon.com/postgresql/postgresql-indexes/postgresql-full-text-search) - GIN index best practices
- [Pedro Alonso - Real-Time Notifications with SSE in Next.js](https://www.pedroalonso.net/blog/sse-nextjs-real-time-notifications/) - SSE patterns (used to evaluate and reject SSE approach)
- [Vercel Next.js Discussion #48427](https://github.com/vercel/next.js/discussions/48427) - SSE limitations in Next.js route handlers

### Tertiary (LOW confidence)
- [Medium - Fixing Slow SSE Streaming in Next.js and Vercel](https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996) - SSE buffering issues on Vercel (Jan 2026)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, Postgres FTS is well-documented with Drizzle
- Architecture: HIGH - Patterns follow existing codebase conventions (server actions, API routes, client polling)
- Pitfalls: HIGH - N+1 RPC problem, search config mismatch, fan-out explosion are well-known patterns
- Notification system: MEDIUM - Polling approach is simple and proven but the holder proxy (trade history vs actual balance) is an approximation

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (stable domain, unlikely to change)
