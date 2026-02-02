---
phase: 06-token-trading
plan: 05
subsystem: trade-history
tags: [trade-history, holdings, pnl, server-actions, pagination]
dependency-graph:
  requires: [06-01, 06-03]
  provides: [trade-history-ui, holdings-pnl, getTradeHistory-action, getHoldings-action]
  affects: []
tech-stack:
  added: []
  patterns: [cursor-pagination, sql-aggregation, relative-time-formatting]
key-files:
  created:
    - app/trade/[token]/trade-history.tsx
  modified:
    - app/trade/[token]/actions.ts
    - app/trade/[token]/page.tsx
    - app/trade/[token]/trade-form.tsx
decisions:
  - id: "06-05-01"
    decision: "Holdings P&L uses SQL aggregation of confirmed trades (not on-chain token balance) for accuracy"
  - id: "06-05-02"
    decision: "Relative time formatting uses simple utility function (no external library like date-fns)"
  - id: "06-05-03"
    decision: "Holdings card hidden entirely when no confirmed trades exist (no empty state)"
metrics:
  duration: "~3.5 min"
  completed: "2026-02-02"
---

# Phase 6 Plan 5: Trade History & Holdings P&L Summary

Trade history list with buy/sell badges, pending spinners, explorer links, and load-more pagination, plus holdings card with weighted-average buy price P&L calculation from confirmed trade aggregation.

## What Was Built

### Trade History Server Action (`app/trade/[token]/actions.ts`)
- `getTradeHistory(mintAddress, limit, offset)`: Authenticated, returns user's trades for a specific token
- Pagination via limit/offset with hasMore flag (fetches limit+1 to detect more)
- Returns trades ordered by createdAt DESC with BigInt values as strings
- Returns empty array for unauthenticated users (no error)

### Holdings Server Action (`app/trade/[token]/actions.ts`)
- `getHoldings(mintAddress)`: Authenticated, returns user's P&L for a token
- SQL aggregation of confirmed buy/sell trades for totals
- Calculates: net tokens, avg buy price (weighted), current value (from bonding curve spot price)
- Unrealized P&L = current value - cost basis, with percentage
- Returns null when no trades or net position is zero/negative

### Trade History UI (`app/trade/[token]/trade-history.tsx`)
- Desktop: table layout with Type, Amount, SOL, Price, Time, Status, Explorer link columns
- Mobile: stacked card layout with same data in compact form
- Type badges: green "BUY" / red "SELL" pill badges
- Status indicators: animated spinner for pending, red badge for failed, nothing for confirmed
- Relative time: "2m ago", "1h ago", "3d ago", "Jan 31" for older
- Explorer links: external-link icon opens Solana Explorer in new tab
- Loading skeleton: 3 shimmer rows during initial fetch
- Empty state: "No trades yet" centered message
- Load more: button at bottom when hasMore=true, appends to list

### Holdings Card (`app/trade/[token]/trade-form.tsx`)
- Replaced placeholder holdings card with data-driven P&L version
- Shows: token balance, current SOL value, avg buy price, unrealized P&L
- P&L color-coded: green with TrendingUp for profit, red with TrendingDown for loss
- P&L percentage displayed with +/- prefix
- Card hidden entirely when getHoldings returns null (no trades)
- Fetches on mount alongside initial quote

## Decisions Made

1. **SQL aggregation over on-chain balance** -- Holdings P&L uses SUM of confirmed trades rather than reading on-chain token balance. This ensures accuracy with the app's own trade records and avoids needing RPC calls for token account balance.
2. **No date-fns dependency** -- Relative time formatting uses a simple utility function (~15 lines) instead of adding a library dependency. Sufficient for "Xs/m/h/d ago" and short date fallback.
3. **Hidden card vs empty state** -- Holdings card is hidden entirely when no data rather than showing an empty "no holdings" state. The trade form already implies the user can trade.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit` passes with zero errors (both tasks)
- Trade history renders with proper desktop table and mobile card layouts
- Empty state shows "No trades yet" when no trades exist
- Pending trades display animated spinner badge
- Explorer links point to correct Solana Explorer URL with devnet cluster
- Holdings card shows P&L with color coding
- Holdings card hidden when user has no confirmed trades

## Next Phase Readiness

Phase 6 (Token Trading) is now complete with all 5 plans delivered:
- 06-01: Trading core infrastructure (math, builders, schema, actions)
- 06-02: Trading UI (form, quote preview, slippage, confirmation)
- 06-03: Helius webhooks for trade confirmation
- 06-04: Price chart with TradingView Lightweight Charts
- 06-05: Trade history and holdings P&L

Ready for Phase 7.
