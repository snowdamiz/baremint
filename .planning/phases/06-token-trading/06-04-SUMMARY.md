---
phase: 06-token-trading
plan: 04
subsystem: price-visualization
tags: [lightweight-charts, candlestick, bonding-curve, ohlcv, svg]
dependency-graph:
  requires: [06-01, 06-03]
  provides: [price-chart, bonding-curve-viz, ohlcv-query]
  affects: [06-05]
tech-stack:
  added: [lightweight-charts]
  patterns: [dynamic-import-ssr-false, ohlcv-aggregation, svg-visualization]
key-files:
  created:
    - app/trade/[token]/price-chart.tsx
    - app/trade/[token]/price-chart-inner.tsx
    - app/trade/[token]/curve-viz.tsx
  modified:
    - app/trade/[token]/actions.ts
    - app/trade/[token]/page.tsx
decisions:
  - id: "06-04-01"
    decision: "UTCTimestamp cast for lightweight-charts Time type compatibility"
    context: "lightweight-charts expects branded Time type, not plain number"
  - id: "06-04-02"
    decision: "Inline SVG for bonding curve (no external charting library)"
    context: "Avoids extra dependency; curve is static constant-product formula"
  - id: "06-04-03"
    decision: "Collapsible curve viz default-closed to save vertical space"
    context: "Price chart is primary; curve is supplementary info"
metrics:
  duration: ~4 min
  completed: 2026-02-02
---

# Phase 6 Plan 04: Price Chart & Bonding Curve Visualization Summary

**TL;DR:** TradingView Lightweight Charts candlestick/line chart with 6 time intervals, plus SVG bonding curve visualization with reserve stats -- all SSR-safe via dynamic import.

## Completed Tasks

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Price chart with TradingView Lightweight Charts | 2942538 | price-chart.tsx, price-chart-inner.tsx, actions.ts |
| 2 | Bonding curve visualization and page integration | 5483d3f | curve-viz.tsx, page.tsx |

## What Was Built

### OHLCV Data Query (getChartData server action)
- Raw SQL aggregation from trade table with configurable time buckets (5M to 1W)
- Computes open/high/low/close from price ratios (solAmount/tokenAmount)
- Returns candlestick data for 5+ buckets, line data for sparse history, empty for no trades
- Uses drizzle `sql` template with safe interval mapping (no SQL injection)

### Price Chart (Lightweight Charts)
- Dynamic import wrapper (`ssr: false`) prevents SSR crash from `document`/`window` access
- Candlestick series with green/red colors for up/down candles
- Falls back to indigo line chart when fewer than 5 data points
- Time interval selector row: 5M, 15M, 1H, 4H, 1D, 1W with loading spinner
- ResizeObserver for responsive width adaptation
- Dark mode detection from `document.documentElement` class
- Empty state overlay: "No trades yet" with dimmed chart area

### Bonding Curve Visualization (SVG)
- Constant-product curve rendered as 50-point SVG path
- Current position marked with dot and ring indicator
- Filled area (emerald) under curve up to current supply shows SOL in reserves
- Collapsible widget with progress badge in header
- Stats row: SOL in reserves, tokens in circulation, curve progress percentage

### Page Integration
- PriceChart and CurveViz integrated between TokenStats and TradeHistory
- All BigInt values serialized as strings from server component to client props

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **UTCTimestamp cast** -- lightweight-charts uses a branded `Time` type; cast `number` to `UTCTimestamp` for type compatibility
2. **Inline SVG for curve** -- no need for another charting library; the bonding curve is a simple mathematical formula rendered as SVG path
3. **Default collapsed curve viz** -- keeps the primary price chart visible without excessive scroll

## Verification

- `npx tsc --noEmit` passes
- `npm run build` succeeds (no SSR crash)
- Dynamic import with `ssr: false` prevents document/window errors at build time
- Time interval buttons rendered with active state styling
- Curve viz collapsible with chevron rotation animation

## Next Phase Readiness

Plan 06-05 (if any remaining) can build on the trade history component already integrated. The OHLCV query pattern established here can be extended for volume charts or other analytics.
