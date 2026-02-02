---
phase: 06-token-trading
plan: 02
subsystem: trading-ui
tags: [react, next.js, shadcn, sonner, bonding-curve, trade-form]
dependency-graph:
  requires: [06-01]
  provides: [trade-page, trade-form, token-stats, slippage-popover]
  affects: [06-03, 06-04, 06-05]
tech-stack:
  added: ["@radix-ui/react-popover"]
  patterns: [debounced-quote, review-dialog, quick-amount-buttons, rational-price-display]
key-files:
  created:
    - app/trade/[token]/page.tsx
    - app/trade/[token]/trade-form.tsx
    - app/trade/[token]/token-stats.tsx
    - components/ui/popover.tsx
  modified: []
decisions:
  - id: "06-02-01"
    decision: "Price display uses Number(sol)/Number(token) ratio (safe for display, not for math)"
  - id: "06-02-02"
    decision: "Review dialog threshold is 0.1 SOL (buy amount or estimated sell output)"
  - id: "06-02-03"
    decision: "Slippage default 1% (100 bps), stored in local state (not persisted)"
  - id: "06-02-04"
    decision: "Quote debounce 300ms to avoid excessive server action calls"
metrics:
  duration: "~3 min"
  completed: "2026-02-02"
---

# Phase 6 Plan 2: Trading UI Summary

Complete trade page at /trade/[token] with buy/sell tabs, live fee breakdown via getQuote, slippage popover, quick-amount buttons, review dialog for large trades, and token stats card with on-chain price/market cap.

## What Was Built

### Trade Page (`app/trade/[token]/page.tsx`)
- Server component loading token data from DB (creatorToken + creatorProfile join)
- On-chain bonding curve and global config loaded via readBondingCurveAccount/readGlobalConfig
- Two-column layout on desktop (stats/chart left, trade form right), stacked on mobile
- Trade form is sticky on desktop for scroll persistence
- BigInt values serialized as strings for client component props
- Returns notFound() for invalid mint addresses
- Placeholder areas for price chart (Plan 04) and trade history (Plan 05)

### Token Stats (`app/trade/[token]/token-stats.tsx`)
- Token identity: name, ticker, creator avatar + display name linked to profile
- Price: derived from virtualSolReserves / virtualTokenReserves ratio
- Market cap: price * circulating supply (total - real token reserves)
- Circulating supply: formatted with K/M/B suffixes
- Placeholder dashes for 24h volume, holders, 24h change (populated after Plan 03 webhook)

### Trade Form (`app/trade/[token]/trade-form.tsx`)
- Buy/sell tab switcher with green/red accent colors
- SOL input for buy, token input for sell with numeric-only validation
- Quick-amount buttons (25%, 50%, 75%, MAX) calculated from wallet balance
- Slippage popover (gear icon): presets 0.5%/1%/2% + custom input, default 1%
- Live quote preview: debounced 300ms, calls getQuote server action
- Fee breakdown: platform fee, creator fee, total fee (6 decimal places SOL)
- Price impact: green (<1%), yellow (1-5%), red (>5%) color coding
- Review dialog for trades >= 0.1 SOL showing full trade summary
- Sonner toast on success with truncated tx signature + explorer link
- Sonner toast on error with descriptive message
- Holdings card below form showing token balance and current SOL value
- Loading shimmer/skeleton during quote fetch

### Popover Component (`components/ui/popover.tsx`)
- Standard shadcn Popover component added for slippage settings

## Decisions Made

1. **Display-only float conversion** -- Token stats price display uses Number() division (safe for display, all math stays BigInt in server actions).
2. **0.1 SOL review threshold** -- Trades >= 0.1 SOL show confirmation dialog; smaller trades execute immediately for frictionless UX.
3. **Slippage in local state** -- Not persisted to DB or localStorage; resets to 1% default on page load. Can be enhanced later.
4. **300ms quote debounce** -- Prevents excessive server action calls while typing.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit` passes with zero errors
- Trade page renders two-column layout with token stats and trade form
- Fee breakdown shows platform fee, creator fee, total fee (TOKN-03 transparency)
- Slippage popover opens with presets and custom input
- Quick-amount buttons calculate from balance props
- Review dialog triggers for trades >= 0.1 SOL

## Next Phase Readiness

Trading UI is ready for:
- **06-03**: Webhook can update trade status; volume/holder data populates token stats
- **06-04**: Price chart component drops into left column placeholder
- **06-05**: Trade history component drops into left column placeholder
