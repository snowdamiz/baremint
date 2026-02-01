---
phase: 02-bonding-curve-smart-contract
plan: 01
subsystem: smart-contract
tags: [anchor, solana, rust, bonding-curve, pda, spl-token]

# Dependency graph
requires:
  - phase: none
    provides: standalone smart contract scaffold
provides:
  - Anchor workspace integrated into existing Next.js project
  - GlobalConfig, BondingCurve, VestingAccount, CreatorProfile account structs
  - Initialize instruction with fee validation
  - Comprehensive ErrorCode enum (14 variants)
  - TypeScript test dependencies (anchor-bankrun, solana-bankrun)
affects: [02-02, 02-03, 02-04, all future smart contract plans]

# Tech tracking
tech-stack:
  added: [anchor-lang 0.32.0, anchor-spl 0.32.0, @coral-xyz/anchor, @solana/web3.js, anchor-bankrun, solana-bankrun, jest, ts-jest]
  patterns: [Anchor PDA account pattern, InitSpace derive, fee validation in instruction handler, workspace Cargo.toml for Anchor in Next.js project]

key-files:
  created:
    - programs/baremint/src/lib.rs
    - programs/baremint/src/state/global_config.rs
    - programs/baremint/src/state/bonding_curve.rs
    - programs/baremint/src/state/vesting.rs
    - programs/baremint/src/state/creator_profile.rs
    - programs/baremint/src/errors.rs
    - programs/baremint/src/instructions/initialize.rs
    - Anchor.toml
    - Cargo.toml
  modified:
    - package.json
    - .gitignore

key-decisions:
  - "Pinned blake3=1.5.5 to avoid edition2024 incompatibility with SBF platform-tools"
  - "Used Solana CLI v2.3.3 with platform-tools v1.48 for build compatibility"
  - "Tasks 1 and 2 committed together since initialize instruction was naturally part of scaffold"

patterns-established:
  - "Anchor PDA seeds pattern: [b'global_config'] for GlobalConfig, [b'creator_profile', creator.key()] for CreatorProfile"
  - "Fee accrual tracking: platform_fees_accrued/creator_fees_accrued on BondingCurve PDA"
  - "Validation pattern: require! macros with custom ErrorCode returns"

# Metrics
duration: 14min
completed: 2026-02-01
---

# Phase 2 Plan 1: Anchor Scaffold & State Accounts Summary

**Anchor program scaffold with 4 state account structs (GlobalConfig, BondingCurve, VestingAccount, CreatorProfile), 14 error codes, and GlobalConfig initialize instruction with fee validation**

## Performance

- **Duration:** 14 min
- **Started:** 2026-02-01T09:34:59Z
- **Completed:** 2026-02-01T09:48:37Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Scaffolded Anchor workspace inside existing Next.js project (Cargo.toml, Anchor.toml, program structure)
- Defined all 4 state account structs with InitSpace derive and comprehensive field documentation
- BondingCurve includes platform_fees_accrued and creator_fees_accrued for fee tracking from day one
- Implemented GlobalConfig initialize instruction with fee split validation (fee_bps == platform + creator, max 10%)
- Installed TypeScript test dependencies (anchor-bankrun, solana-bankrun, jest, ts-jest)
- Program builds and produces .so binary with correct program ID (FTAssMPiQ8EQUeJA4Rnu6c71maCrUCdnvGetWnVdTXTG)

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Scaffold Anchor project + Initialize instruction** - `c375be9` (feat)

**Plan metadata:** pending

## Files Created/Modified
- `Anchor.toml` - Anchor workspace config with program ID and test settings
- `Cargo.toml` - Workspace Cargo.toml with release profile overflow-checks
- `programs/baremint/Cargo.toml` - Program dependencies (anchor-lang, anchor-spl, blake3 pin)
- `programs/baremint/Xargo.toml` - Cross-compilation config for BPF
- `programs/baremint/src/lib.rs` - Program entrypoint with declare_id! and initialize dispatch
- `programs/baremint/src/state/mod.rs` - State module re-exports
- `programs/baremint/src/state/global_config.rs` - GlobalConfig struct (authority, fees, vesting, cooldown params)
- `programs/baremint/src/state/bonding_curve.rs` - BondingCurve struct (reserves, supply, fee accrual fields)
- `programs/baremint/src/state/vesting.rs` - VestingAccount struct (allocation, cliff, claimed tracking)
- `programs/baremint/src/state/creator_profile.rs` - CreatorProfile struct (launch cooldown enforcement)
- `programs/baremint/src/errors.rs` - ErrorCode enum with 14 variants
- `programs/baremint/src/instructions/mod.rs` - Instructions module re-exports
- `programs/baremint/src/instructions/initialize.rs` - Initialize handler with fee validation
- `package.json` - Added test dependencies
- `.gitignore` - Added target/ and test-ledger/

## Decisions Made
- **blake3 pin:** Pinned blake3=1.5.5 in program Cargo.toml because blake3 1.8.3 requires Rust edition2024 which is unsupported by SBF platform-tools (v1.48 ships Cargo 1.84). This is a transitive dependency from Solana crates.
- **Solana CLI v2.3.3:** Used latest stable Solana CLI for platform-tools v1.48 (Cargo 1.84, Rust nightly).
- **Combined commit:** Tasks 1 and 2 were committed together since the initialize instruction is integral to the project scaffold and shares most files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed Solana CLI and Anchor CLI**
- **Found during:** Task 1 (build verification)
- **Issue:** Neither Solana CLI nor Anchor CLI were installed on the system
- **Fix:** Installed Solana CLI v2.3.3 via official installer, Anchor CLI v0.32.0 via cargo install, and rustup for SBF toolchain
- **Files modified:** None (system tooling)
- **Verification:** `anchor build` succeeds, `anchor keys list` returns program ID
- **Committed in:** N/A (tooling install)

**2. [Rule 3 - Blocking] Pinned blake3 to avoid edition2024 build failure**
- **Found during:** Task 1 (anchor build)
- **Issue:** blake3 1.8.3 requires Rust edition2024, unsupported by SBF platform-tools Cargo 1.84
- **Fix:** Added blake3 = "=1.5.5" as direct dependency in program Cargo.toml to force compatible version
- **Files modified:** programs/baremint/Cargo.toml
- **Verification:** `anchor build` compiles successfully
- **Committed in:** c375be9

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary to unblock building. No scope creep.

## Issues Encountered
- SBF platform-tools v1.45 (Solana 2.2.3) had Cargo 1.79 which also failed; upgraded to Solana 2.3.3 (platform-tools v1.48, Cargo 1.84) which resolved most issues but still needed blake3 pin.
- Homebrew Rust installation conflicted with rustup; used -y flag to proceed alongside existing installation.

## User Setup Required
None - no external service configuration required. Solana CLI, Anchor CLI, and rustup are now installed locally.

## Next Phase Readiness
- Anchor project builds successfully with correct program ID
- All state account types ready for use in subsequent instructions (create_token, buy, sell, etc.)
- Initialize instruction ready for integration testing in plan 02-02+
- TypeScript test dependencies installed for bankrun-based tests

---
*Phase: 02-bonding-curve-smart-contract*
*Completed: 2026-02-01*
