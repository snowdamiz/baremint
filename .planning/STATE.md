# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-31)

**Core value:** Creators can monetize content through their own token economy without viewers needing to understand crypto
**Current focus:** Phase 3 - Creator Onboarding & Token Launch

## Current Position

Phase: 3 of 9 (Creator Onboarding & Token Launch)
Plan: 0 of 4 in current phase
Status: Ready to plan
Last activity: 2026-02-01 — Phase 2 complete, verified ✓

Progress: [████████░░░░░░░░░░░░░░░░░░░░░░░░░░░] 7/35 (~20%)

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: ~7 minutes
- Total execution time: ~51 minutes

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Auth & Wallets | 3/3 | ~16 min | ~5 min |
| 2. Bonding Curve | 4/4 | ~35 min | ~9 min |

**Recent Trend:**
- Last 5 plans: 02-01 (~14 min), 02-02 (~5 min), 02-03 (~3 min), 02-04 (~13 min)
- Trend: 02-04 longer due to 52-test suite requiring iterative debugging of BigInt types, rounding edge cases, and bankrun quirks

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 9 phases derived from 42 requirements, comprehensive depth
- [Roadmap]: Phases 1 and 2 can run in parallel (no mutual dependencies)
- [01-01]: Used sonner instead of deprecated shadcn toast component
- [01-01]: Made database connection lazy via Proxy to allow builds without DATABASE_URL
- [01-01]: Installed all Phase 1 deps upfront (Solana, Helius, QR) to avoid package.json churn
- [01-02]: Used Node.js crypto for Ed25519 keypair (Web Crypto keys non-extractable)
- [01-02]: Wallet creation failure does not block user signup (try/catch with logging)
- [01-02]: BigInt(0) instead of 0n literal due to ES2017 target
- [01-03]: Used Better Auth socialProviders config for Google/Twitter OAuth
- [01-03]: 4-step 2FA setup dialog: password -> QR -> verify -> backup codes
- [01-03]: Server-side auth.api.verifyTOTP before SOL transfer (security-critical)
- [01-03]: URL search params for withdrawal review page (stateless navigation)
- [Orchestrator]: Added pg driver for local Postgres dev (auto-detect Neon vs local in lib/db/index.ts)
- [Orchestrator]: Auth form defaults to login step instead of signup for returning users
- [02-01]: Pinned blake3=1.5.5 for SBF platform-tools compatibility (edition2024 unsupported)
- [02-01]: Using Solana CLI v2.3.3 / Anchor CLI v0.32.0 / platform-tools v1.48
- [02-01]: Program ID: FTAssMPiQ8EQUeJA4Rnu6c71maCrUCdnvGetWnVdTXTG
- [02-02]: Fee deducted before curve calc on buy, after curve calc on sell
- [02-02]: All SOL in bonding_curve PDA -- fees tracked via accrual fields, no separate vaults
- [02-02]: Sell uses lamport manipulation (program owns PDA), buy uses system_program::transfer CPI
- [02-02]: Buyer must pre-create ATA client-side before buy instruction
- [02-03]: Burn-for-access is purely deflationary -- no SOL returned to viewer, fees extracted from reserves
- [02-03]: Fee withdrawal uses lamport manipulation (same pattern as sell)
- [02-03]: Vesting claims snap to weekly windows (floor division)
- [02-03]: Revoke vesting is idempotent (returns Ok if already revoked)
- [02-04]: Constant-product round-trip can return 1 lamport more than deposited (integer rounding)
- [02-04]: Weekly vesting snapping means max ~93.3% claimable (8 of 8.57 weeks)
- [02-04]: First claimable vesting window is cliff + 7 days (day 37), not cliff itself
- [02-04]: Bankrun tests require --runInBand for stability (native code race conditions)
- [02-04]: Devnet deployment pending SOL funding (airdrop rate-limited)

### Pending Todos

- Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET for Google OAuth
- Set TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET for Twitter OAuth
- Fund devnet wallet and deploy program (when airdrop faucet available)

### Blockers/Concerns

- Phase 4 needs phase-level research (PhotoDNA access, NCMEC reporting, video transcoding)
- Audit firm selection needed before Phase 2 smart contract can go to mainnet
- Vesting weekly snapping leaves ~6.7% of allocation permanently locked (design decision to document)

## Session Continuity

Last session: 2026-02-01
Stopped at: Phase 2 complete and verified, ready for Phase 3
Resume file: None
