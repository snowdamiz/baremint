---
phase: "08"
plan: "03"
subsystem: "donations"
tags: ["solana", "spl-token", "donations", "tips", "server-actions"]
depends_on:
  requires: ["01-02", "06-01"]
  provides: ["donation-table", "token-transfer-builder", "donate-server-actions"]
  affects: ["08-04"]
tech-stack:
  added: []
  patterns: ["pure-transfer-extraction", "idempotent-ata-creation", "self-tip-prevention"]
key-files:
  created:
    - "lib/solana/token-transfer.ts"
    - "app/trade/[token]/donate-actions.ts"
  modified:
    - "lib/db/schema.ts"
    - "lib/solana/transfer.ts"
decisions:
  - id: "08-03-01"
    decision: "Extract pure sendSolTransfer from buildAndSendSolTransfer to avoid withdrawal side effects in donation flow"
    context: "Existing SOL transfer function inserts withdrawal record; donations need transfer-only"
  - id: "08-03-02"
    decision: "Self-tip prevention via wallet address comparison before transaction"
    context: "Viewers should not be able to tip themselves"
metrics:
  duration: "~2 min"
  completed: "2026-02-02"
---

# Phase 8 Plan 3: Donation Backend Summary

**One-liner:** Donation DB table, SPL token transfer builder, and SOL/token tip server actions with self-tip prevention

## What Was Built

### Donation Table (lib/db/schema.ts)
- `donation` table with columns: id, fromUserId, toCreatorProfileId, type (sol/token), amount, mintAddress, txSignature, status, createdAt
- Status defaults to "confirmed" (optimistic, matching withdrawal pattern)
- All amounts stored as BigInt strings

### Token Transfer Builder (lib/solana/token-transfer.ts)
- `buildAndSendTokenTransfer(userId, recipientAddress, mintAddress, amount)` -- pure SPL token transfer
- Derives sender and recipient ATAs from wallet addresses
- Creates recipient ATA idempotently via `getCreateAssociatedTokenIdempotentInstructionAsync`
- Uses `getTransferInstruction` from `@solana-program/token` for the actual transfer
- Follows same pipe pattern as trade.ts

### Transfer Refactoring (lib/solana/transfer.ts)
- Extracted `getUserWalletSigner(userId)` -- shared signer creation from encrypted wallet
- Extracted `sendSolTransfer(userId, toAddress, amountLamports)` -- pure SOL transfer without DB side effects
- `buildAndSendSolTransfer` now delegates to `sendSolTransfer` + adds withdrawal record

### Donation Server Actions (app/trade/[token]/donate-actions.ts)
- `donateSol(mintAddress, amountLamports)` -- SOL tip from viewer to creator
- `donateToken(mintAddress, amount)` -- token tip from viewer to creator
- `getDonationHistory(mintAddress)` -- last 50 tips to a creator with sender names
- All actions: authenticate user, validate input, look up creator wallet via join chain, prevent self-tipping, execute on-chain transfer, record in donation table

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracted pure SOL transfer from withdrawal-coupled function**
- **Found during:** Task 2
- **Issue:** `buildAndSendSolTransfer` in transfer.ts always inserts a withdrawal record, but donations need transfer-only
- **Fix:** Extracted `sendSolTransfer` (pure transfer) and `getUserWalletSigner` (shared helper); existing function now delegates to the pure version
- **Files modified:** lib/solana/transfer.ts
- **Commit:** 7cb88c8

**2. [Rule 2 - Missing Critical] Added self-tip prevention**
- **Found during:** Task 2
- **Issue:** Without prevention, a creator could tip themselves, creating fake donation history
- **Fix:** Compare viewer wallet publicKey with creator wallet publicKey before executing transfer
- **Files modified:** app/trade/[token]/donate-actions.ts
- **Commit:** 7cb88c8

## Verification Results

1. `npx tsc --noEmit` -- zero type errors
2. `donation` table pushed to database via `drizzle-kit push`
3. `lib/solana/token-transfer.ts` exports `buildAndSendTokenTransfer`
4. `app/trade/[token]/donate-actions.ts` exports `donateSol`, `donateToken`, `getDonationHistory`

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Donation DB table and migration | 74372ea | lib/db/schema.ts |
| 2 | Token transfer builder and donation server actions | 7cb88c8 | lib/solana/token-transfer.ts, lib/solana/transfer.ts, app/trade/[token]/donate-actions.ts |

## Next Phase Readiness

- Donation table ready for Phase 8 Plan 4 (donation UI components)
- Server actions provide the complete backend for SOL and token tipping
- `getDonationHistory` ready for rendering in donation feed/list
