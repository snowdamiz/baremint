# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-31)

**Core value:** Creators can monetize content through their own token economy without viewers needing to understand crypto
**Current focus:** Phase 2 - Bonding Curve Smart Contract

## Current Position

Phase: 2 of 9 (Bonding Curve Smart Contract)
Plan: 2 of 4 in current phase
Status: In progress
Last activity: 2026-02-01 — Completed 02-02-PLAN.md

Progress: [█████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 5/35 (~14%)

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: ~7 minutes
- Total execution time: ~35 minutes

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Auth & Wallets | 3/3 | ~16 min | ~5 min |
| 2. Bonding Curve | 2/4 | ~19 min | ~10 min |

**Recent Trend:**
- Last 5 plans: 01-02 (~3 min), 01-03 (~8 min), 02-01 (~14 min), 02-02 (~5 min)
- Trend: 02-02 fast -- pure Rust implementation with no toolchain issues

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

### Pending Todos

- Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET for Google OAuth
- Set TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET for Twitter OAuth

### Blockers/Concerns

- Phase 4 needs phase-level research (PhotoDNA access, NCMEC reporting, video transcoding)
- Audit firm selection needed before Phase 2 smart contract can go to mainnet

## Session Continuity

Last session: 2026-02-01T09:57:22Z
Stopped at: Completed 02-02-PLAN.md (Core trading instructions: math, create_token, buy, sell)
Resume file: None
