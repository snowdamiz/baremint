---
phase: "08"
plan: "02"
subsystem: "creator-monetization"
tags: ["solana", "vesting", "trade-fees", "server-actions", "interactive-ui"]
dependency-graph:
  requires: ["08-01"]
  provides: ["withdraw-creator-fees", "claim-vested-tokens", "earnings-dashboard-interactive"]
  affects: []
tech-stack:
  added: []
  patterns: ["client-component-wrapper-for-interactive-server-data", "useTransition-for-server-action-loading"]
key-files:
  created:
    - "app/(dashboard)/dashboard/creator/earnings/earnings-dashboard.tsx"
  modified:
    - "lib/solana/trade.ts"
    - "app/trade/[token]/earnings-actions.ts"
    - "app/(dashboard)/dashboard/creator/earnings/page.tsx"
decisions:
  - id: "08-02-01"
    choice: "Client component wrapper pattern for interactive buttons"
    reason: "Server component page fetches data, passes to client component for interactivity"
  - id: "08-02-02"
    choice: "useTransition for loading states instead of useState"
    reason: "Matches existing trade form pattern, integrates with server actions natively"
metrics:
  duration: "~4 min"
  completed: "2026-02-02"
---

# Phase 8 Plan 2: Claim & Withdraw Instruction Builders + Interactive UI Summary

Instruction builders for withdraw_creator_fees and claim_vested with server actions and interactive earnings dashboard buttons.

## Tasks Completed

### Task 1: Instruction builders (b40c81e)
- Added `WITHDRAW_CREATOR_FEES_DISCRIMINATOR` and `CLAIM_VESTED_DISCRIMINATOR` (computed from sha256 of Anchor global namespace)
- `buildAndSendWithdrawCreatorFees`: verifies creator ownership, checks fees > 0, builds discriminator-only instruction with creator/bondingCurve/tokenMint accounts
- `buildAndSendClaimVested`: verifies creator ownership, calculates claimable > 0, derives vesting PDAs, includes idempotent create-ATA instruction, builds claim instruction with 7 accounts
- Both follow established @solana/kit pipe pattern matching buy/sell/burn functions

### Task 2: Server actions and interactive dashboard (0be3eb8)
- Added `withdrawCreatorFees` and `claimVestedTokens` server actions with auth + ownership verification
- Created `EarningsDashboard` client component extracted from server page
- "Withdraw SOL" button: disabled when currentAccruedFees === "0", shows Loader2 spinner during transaction
- "Claim Tokens" button: disabled when claimable === "0" or vesting is revoked, shows spinner
- Success toasts include Solana Explorer devnet link to transaction signature
- Error toasts show user-friendly error message from server action
- `router.refresh()` revalidates server data after successful operations
- Preserved tip summary and tip history from plan 08-03

## Decisions Made

1. **Client component wrapper pattern**: Server page fetches all data (earnings, tips, tip history), passes earnings data to client `EarningsDashboard` component. Tip history stays in server component since it has no interactivity.

2. **useTransition for loading states**: Using React `useTransition` rather than `useState` for loading state -- integrates natively with server actions and prevents stale UI.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected discriminator byte values**
- **Found during:** Task 1
- **Issue:** Initial discriminator values were placeholder; computed actual sha256 bytes
- **Fix:** Used `node -e "crypto.createHash('sha256')..."` to compute correct bytes
- **Files modified:** lib/solana/trade.ts

**2. [Rule 3 - Blocking] Preserved plan 08-03 tip features**
- **Found during:** Task 2
- **Issue:** earnings page had been updated by plan 08-03 with tip summary, tip history, and donation imports
- **Fix:** Adapted client component to accept optional `tipSummary` prop, preserved tip history rendering in server page
- **Files modified:** earnings-dashboard.tsx, page.tsx

## Verification

- `npx tsc --noEmit` -- zero type errors
- `lib/solana/trade.ts` exports both `buildAndSendWithdrawCreatorFees` and `buildAndSendClaimVested`
- `earnings-actions.ts` exports both `claimVestedTokens` and `withdrawCreatorFees`
- Earnings page renders interactive Withdraw SOL and Claim Tokens buttons
- Buttons properly disabled when amounts are zero
- page.tsx is 211 lines (exceeds 100 line minimum)
