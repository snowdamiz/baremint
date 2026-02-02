---
phase: "08"
plan: "01"
subsystem: "creator-earnings"
tags: ["vesting", "earnings", "dashboard", "on-chain-read", "server-action"]
dependency-graph:
  requires: ["02-03", "06-01", "07-01"]
  provides: ["vesting-reader", "earnings-aggregation", "earnings-dashboard"]
  affects: ["08-02", "08-03"]
tech-stack:
  patterns: ["PDA deserialization", "parallel SQL + on-chain reads", "BigInt-safe server actions"]
key-files:
  created:
    - "lib/solana/vesting-read.ts"
    - "app/trade/[token]/earnings-actions.ts"
    - "app/(dashboard)/dashboard/creator/earnings/page.tsx"
  modified:
    - "components/creator/creator-own-profile.tsx"
decisions:
  - id: "08-01-01"
    description: "VestingAccount reader returns null instead of throwing when PDA not found"
  - id: "08-01-02"
    description: "Trade fee revenue calculated as 50% of total feeAmount from confirmed trades"
  - id: "08-01-03"
    description: "Burn count is display-only count (fees are included in creatorFeesAccrued on-chain)"
metrics:
  duration: "~3 min"
  completed: "2026-02-02"
---

# Phase 8 Plan 1: Creator Earnings Dashboard Summary

JWT auth with vesting PDA reader, SQL revenue aggregation, and server-rendered earnings page showing trade fees, accrued on-chain fees, and vesting status with weekly-snapping claimable calculation.

## What Was Built

### Task 1: VestingAccount Reader (lib/solana/vesting-read.ts)
- `VestingAccountData` interface with all fields (creator, tokenMint, totalAllocation, claimedAmount, startTimestamp, isRevoked, bump)
- `readVestingAccount(mintAddress)` derives PDA with `["vesting", mintBytes]` seeds, returns null if not found
- `calculateClaimable(vesting, config)` implements weekly-snapping linear vesting matching on-chain Rust logic
- All BigInt math preserves precision through the stack

### Task 2: Earnings Aggregation & Dashboard
- `getCreatorEarnings` server action runs 3 parallel queries: SQL trade fee sum, SQL burn count, on-chain reads (bonding curve + vesting + global config)
- Earnings page at `/dashboard/creator/earnings` with three main cards:
  - Trade Fee Revenue (SQL-sourced, creator's 50% share)
  - Accrued Fees (on-chain creatorFeesAccrued, with disabled Withdraw button)
  - Vesting Status (total/claimed/claimable, progress bar, next claim date, disabled Claim button)
- Revenue breakdown section showing trade fees, burns, and tips (placeholder)
- Added "Earnings" link to CreatorOwnProfile component

## Decisions Made

1. **VestingAccount reader returns null** instead of throwing when PDA not found (08-01-01) -- allows graceful handling for tokens without vesting accounts
2. **Trade fee revenue = 50% of feeAmount** from confirmed trades (08-01-02) -- matches the on-chain fee split (platform/creator)
3. **Burn count is display-only** (08-01-03) -- burn fees are already tracked in creatorFeesAccrued on-chain, SQL count is for UX only

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Hash | Description |
|------|-------------|
| 8b18c52 | feat(08-01): VestingAccount reader and claimable calculation |
| 6eb4837 | feat(08-01): earnings aggregation server action and dashboard page |

## Next Phase Readiness

08-02 (claim/withdraw) can now build on:
- `readVestingAccount` and `calculateClaimable` for vesting claim UI
- `getCreatorEarnings` for pre-withdrawal balance display
- Disabled Withdraw/Claim buttons ready to be enabled
