---
phase: 07-burn-to-unlock-premium-content
plan: 01
subsystem: burn-to-unlock-backend
tags: [bonding-curve, burn, access-control, schema, solana]
completed: 2026-02-02
duration: ~3 min
dependency-graph:
  requires: [phase-02, phase-05, phase-06]
  provides: [content_unlock-table, burn-api-routes, burn-transaction-builder, access-control-unlock-check]
  affects: [07-02]
tech-stack:
  added: []
  patterns: [deflationary-burn, permanent-unlock-record, ceiling-division-math]
key-files:
  created:
    - app/api/burn/[postId]/route.ts
  modified:
    - lib/db/schema.ts
    - lib/solana/bonding-curve-math.ts
    - lib/solana/trade.ts
    - lib/content/access-control.ts
    - app/api/content/[postId]/media/route.ts
    - .planning/ROADMAP.md
decisions:
  - id: 07-01-01
    decision: "burn_for_access instruction uses discriminator-only data (no args) -- on-chain program reads burn_sol_price from bonding curve"
  - id: 07-01-02
    decision: "checkContentAccess backward-compatible via optional 3rd param with = {} default"
  - id: 07-01-03
    decision: "Burn API returns mintAddress in quote response for frontend trade page linking"
metrics:
  tasks: 2/2
  commits: 2
---

# Phase 7 Plan 1: Burn-to-Unlock Backend Summary

Complete backend for burn-to-unlock: content_unlock schema with unique index, calculateTokensForSolValue ceiling division math matching Rust, buildAndSendBurnForAccess transaction builder, GET/POST burn API routes, and access control updated to check permanent unlock records for burn_gated posts.

## What Was Built

### Task 1: Schema, Math, and Transaction Builder
- **contentUnlock table** in `lib/db/schema.ts` with userId+postId unique index, txSignature, and tokensBurned fields
- **calculateTokensForSolValue** in `lib/solana/bonding-curve-math.ts` -- ceiling division matching Rust `math::calculate_tokens_for_sol_value`
- **buildAndSendBurnForAccess** in `lib/solana/trade.ts` -- mirrors buy/sell pattern but with discriminator-only instruction data (no args), token_mint set WRITABLE (for burn), no system_program needed

### Task 2: API Routes and Access Control
- **GET /api/burn/[postId]** -- returns burn quote: tokensRequired, burnSolPrice, fee breakdown (total/platform/creator), tokenTicker, mintAddress
- **POST /api/burn/[postId]** -- authenticated endpoint that verifies burn_gated post, checks existing unlock, executes burn tx, creates permanent unlock record
- **checkBurnUnlock** function for querying contentUnlock table
- **checkContentAccess** updated with optional `{ viewerUserId, postId }` 3rd parameter -- burn_gated posts check unlock record before balance
- **Gated media API** now passes viewer identity for unlock record lookups
- **ROADMAP.md** Phase 7 corrected: no SOL return, deflationary burn, burn cost from burn_sol_price

## Decisions Made

1. **Discriminator-only instruction data**: The burn_for_access instruction takes no arguments -- the on-chain program reads burn_sol_price directly from the bonding curve account. This means the client just sends the 8-byte discriminator.

2. **Backward-compatible signature**: `checkContentAccess` third parameter uses `= {}` default so all existing callers (only the media route) continue working without changes.

3. **mintAddress in quote response**: GET /api/burn/[postId] returns mintAddress so the frontend UnlockDialog can link to `/trade/${mintAddress}` without needing a separate prop.

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | b44c443 | feat(07-01): schema, math, and transaction builder for burn-for-access |
| 2 | 9e7143b | feat(07-01): burn API routes, access control updates, ROADMAP corrections |

## Verification Results

1. `npx tsc --noEmit` -- passes with no errors
2. `npx drizzle-kit push` -- content_unlock table applied successfully
3. content_unlock table has unique index on (user_id, post_id)
4. calculateTokensForSolValue uses ceiling division matching Rust implementation
5. buildAndSendBurnForAccess follows same pipe pattern as buy/sell
6. GET /api/burn/[postId] returns burn cost info with tokens and fee breakdown
7. POST /api/burn/[postId] requires auth, checks existing unlock, executes burn, creates record
8. checkContentAccess returns hasAccess=true for burn_gated posts with existing unlock record
9. checkContentAccess signature backward-compatible -- grep confirms single caller compiles
10. Gated media API passes userId + postId for burn_gated unlock checks
11. ROADMAP Phase 7 no longer references SOL return

## Next Phase Readiness

Plan 07-02 (unlock dialog burn flow, post composer burn_gated updates) can proceed immediately. All backend APIs are in place:
- GET /api/burn/[postId] for quoting
- POST /api/burn/[postId] for execution
- Access control automatically grants access after burn unlock
