---
phase: 08-creator-monetization-donations
plan: 04
subsystem: donation-ui
tags: [tip-dialog, donations, earnings, trade-page, creator-profile]
depends_on:
  requires: ["08-03"]
  provides: ["donation-ui", "tip-dialog-component", "earnings-tip-history"]
  affects: ["09"]
tech-stack:
  added: []
  patterns: ["client-dialog-with-server-action", "parallel-data-fetching"]
key-files:
  created:
    - components/donate/tip-dialog.tsx
  modified:
    - app/trade/[token]/page.tsx
    - app/trade/[token]/earnings-actions.ts
    - app/(dashboard)/dashboard/creator/[id]/page.tsx
    - app/(dashboard)/dashboard/creator/earnings/page.tsx
decisions:
  - id: "08-04-01"
    description: "Simple button group for SOL/token toggle instead of shadcn Tabs"
  - id: "08-04-02"
    description: "getTipSummary in earnings-actions.ts aggregates SOL and token tips separately"
metrics:
  duration: "~2.5 min"
  completed: "2026-02-02"
---

# Phase 8 Plan 4: Donation UI Summary

**TipDialog component with SOL/token toggle, trade page and profile integration, earnings tip history with aggregated stats**

## What Was Built

### Task 1: Tip Dialog Component
Created `components/donate/tip-dialog.tsx` -- a reusable client component with:
- Props: `creatorName`, `mintAddress`, `tokenTicker`, optional `trigger`
- SOL/token mode toggle via lightweight button group
- Number input with currency symbol suffix
- Preset quick-select buttons (SOL: 0.01/0.05/0.1/0.5; Token: 100/500/1000/5000)
- Loading state via `useTransition`, calls `donateSol`/`donateToken` server actions
- Sonner toast feedback with Solana Explorer transaction link on success

### Task 2: Integration (Trade Page, Creator Profile, Earnings)
**Trade page:** Added TipDialog below TradeForm in right column. Only shows for authenticated non-creator viewers.

**Creator profile:** Added TipDialog in profile header area. Only shows when viewing another creator's profile and they have a launched token.

**Earnings dashboard:**
- Parallel fetches `getCreatorEarnings`, `getTipSummary`, and `getDonationHistory`
- Revenue breakdown "Tips" card now shows actual count and totals (SOL + token)
- New "Recent Tips" section with list of donations: sender name, amount, type icon, relative time, tx link
- Empty state when no tips received
- Added `getTipSummary` server action to `earnings-actions.ts` for aggregated stats
- Added `formatRelativeTime` helper for human-readable timestamps

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added getTipSummary to earnings-actions.ts**
- Plan mentioned it but it was listed as part of Task 2 action, not a separate task
- Added the function with proper SQL aggregation for SOL and token amounts separately
- Imported donation table into earnings-actions.ts

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 34522a3 | feat(08-04): tip dialog component with SOL/token toggle |
| 2 | 0eb2dd3 | feat(08-04): integrate tip dialog into trade page, creator profile, and earnings |

## Verification

- `npx tsc --noEmit` -- zero type errors
- TipDialog exports correctly from components/donate/tip-dialog.tsx
- Trade page conditionally renders TipDialog for non-creator viewers
- Creator profile conditionally renders TipDialog for non-owner when token exists
- Earnings page fetches tip data in parallel, renders summary and history
- Self-tip prevention enforced at both UI level (conditional render) and server action level
