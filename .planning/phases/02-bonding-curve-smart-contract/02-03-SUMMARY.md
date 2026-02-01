---
phase: "02"
plan: "03"
subsystem: "smart-contract"
tags: ["solana", "anchor", "burn", "vesting", "fees", "deflationary"]

dependency-graph:
  requires: ["02-01", "02-02"]
  provides: ["burn-for-access instruction", "claim-vested instruction", "withdraw-fees instructions", "revoke-vesting instruction", "complete 9-instruction set"]
  affects: ["02-04"]

tech-stack:
  added: []
  patterns: ["deflationary burn (no SOL returned)", "lamport manipulation for fee withdrawal", "PDA signer seeds for vesting token transfers", "weekly vesting windows with cliff enforcement"]

key-files:
  created:
    - "programs/baremint/src/instructions/burn_access.rs"
    - "programs/baremint/src/instructions/withdraw_fees.rs"
    - "programs/baremint/src/instructions/claim_vested.rs"
    - "programs/baremint/src/instructions/revoke_vesting.rs"
  modified:
    - "programs/baremint/src/instructions/mod.rs"
    - "programs/baremint/src/lib.rs"

decisions:
  - id: "burn-no-sol-return"
    description: "Burn-for-access is purely deflationary -- tokens destroyed, no SOL returned to viewer. Fees extracted from bonding_curve PDA reserves."
  - id: "fee-withdrawal-lamport-manipulation"
    description: "Both platform and creator fee withdrawals use lamport manipulation (program owns PDA), same pattern as sell instruction."
  - id: "vesting-weekly-snap"
    description: "Vesting claims snap to weekly windows (floor division), preventing daily micro-claims."
  - id: "revoke-idempotent"
    description: "Revoke vesting is idempotent -- calling on already-revoked vesting returns Ok without error."

metrics:
  duration: "~3 minutes"
  completed: "2026-02-01"
---

# Phase 2 Plan 3: Burn, Vesting & Fees Instructions Summary

Deflationary burn-for-access, cliff-gated vesting with weekly claims, platform/creator fee withdrawals, and admin vesting revocation -- completing all 9 program instructions.

## What Was Built

### Task 1: burn_for_access + withdraw_fees (commit 8ea7dcc)

**burn_access.rs** -- Burn-for-access instruction:
- SOL-denominated pricing via `calculate_tokens_for_sol_value` (rounds UP, protocol-favorable)
- Burns tokens from viewer account (deflationary, no SOL returned)
- Fees calculated on SOL equivalent, extracted from bonding_curve reserves into accrual fields
- `virtual_token_reserves` unchanged on burn -- remaining holders benefit from price increase
- `token_total_supply` tracked for deflation

**withdraw_fees.rs** -- Two fee withdrawal handlers:
- `withdraw_platform_fees`: authority-gated (global_config.authority check), transfers accrued platform fees from bonding_curve PDA via lamport manipulation
- `withdraw_creator_fees`: creator-gated (bonding_curve.creator check), transfers accrued creator fees
- Both enforce rent-exemption safety before transfer

### Task 2: claim_vested + revoke_vesting (commit 7122857)

**claim_vested.rs** -- Creator vesting claim:
- 30-day cliff enforcement (`start_timestamp + vesting_cliff_seconds`)
- Weekly claim windows (floor division snap to `vesting_claim_interval_seconds`)
- Linear vesting: `total_vested = total_allocation * snapped_elapsed / vesting_duration_seconds`
- u128 intermediate math to prevent overflow
- VestingAccount PDA signs token transfers

**revoke_vesting.rs** -- Admin revocation on creator ban:
- Admin-only (global_config.authority check)
- Burns unvested tokens from vesting_token_account (deflationary)
- Updates `bonding_curve.token_total_supply` for deflation tracking
- Idempotent: re-calling on revoked vesting returns Ok

## Complete Instruction Set (9 total)

| # | Instruction | Plan | Purpose |
|---|-------------|------|---------|
| 1 | initialize | 02-01 | Create GlobalConfig with fee/vesting params |
| 2 | create_token | 02-02 | Mint 1B tokens, 90/10 split, revoke mint authority |
| 3 | buy | 02-02 | Buy tokens via bonding curve with fee deduction |
| 4 | sell | 02-02 | Sell tokens back to curve with fee deduction |
| 5 | burn_for_access | 02-03 | Deflationary burn for content access |
| 6 | claim_vested | 02-03 | Creator claims vested tokens after cliff |
| 7 | withdraw_platform_fees | 02-03 | Platform withdraws accrued fees |
| 8 | withdraw_creator_fees | 02-03 | Creator withdraws accrued fees |
| 9 | revoke_vesting | 02-03 | Admin revokes vesting on creator ban |

## Verification Results

- `anchor build`: Success (all 9 instructions compile)
- IDL: Contains all 9 instruction definitions
- `cargo test`: 14/14 math tests pass
- buy.rs/sell.rs: Unchanged from Plan 02-02

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Burn-for-access is purely deflationary**: No SOL returned to viewer. Tokens destroyed. Fee SOL extracted from reserves into accrual fields. This benefits remaining token holders as price increases.

2. **Fee withdrawal via lamport manipulation**: Same pattern as sell instruction. Program owns the bonding_curve PDA so can directly modify lamports. Rent-exemption check prevents draining below minimum balance.

3. **Vesting claims snap to weekly windows**: `weeks_elapsed = elapsed_since_cliff / interval_seconds`, then `snapped = weeks * interval`. Prevents gaming with frequent micro-claims.

4. **Revoke vesting is idempotent**: Returns Ok if already revoked rather than erroring. Simpler for admin tooling.

## Next Phase Readiness

Plan 02-04 (integration tests) can proceed. All 9 instructions are compiled and wired. The program is ready for end-to-end testing on localnet.
