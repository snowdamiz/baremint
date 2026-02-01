# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-31)

**Core value:** Creators can monetize content through their own token economy without viewers needing to understand crypto
**Current focus:** Phase 4 - Content Infrastructure

## Current Position

Phase: 4 of 9 (Content Infrastructure)
Plan: 4 of 5 in current phase (04-04 running in parallel)
Status: In progress
Last activity: 2026-02-01 — Completed 04-05-PLAN.md

Progress: [███████████████░░░░░░░░░░░░░░░░░░░░░] 15/35 (~43%)

## Performance Metrics

**Velocity:**
- Total plans completed: 15
- Average duration: ~6 minutes
- Total execution time: ~84 minutes

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Auth & Wallets | 3/3 | ~16 min | ~5 min |
| 2. Bonding Curve | 4/4 | ~35 min | ~9 min |
| 3. Creator Onboarding | 4/4 | ~17 min | ~4 min |
| 4. Content Infrastructure | 4/5 | ~16 min | ~4 min |

**Recent Trend:**
- Last 5 plans: 04-01 (~3 min), 04-02 (~4 min), 04-03 (~5 min), 04-05 (~4 min)

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
- [03-01]: R2 presigned URL upload pattern -- browser uploads directly to R2
- [03-01]: useState for wizard step management (single-page flow, no route-based steps)
- [03-01]: Display name immutable after creation to prevent impersonation
- [03-01]: Image output as WebP at 0.85 quality (avatar 400x400, banner 1200x400)
- [03-02]: Dynamic import for Sumsub WebSDK to avoid SSR hydration errors
- [03-02]: User ID as Sumsub externalUserId for applicant mapping
- [03-02]: Return 200 on webhook processing errors to prevent Sumsub retry storms
- [03-02]: Timing-safe HMAC comparison for webhook signature verification
- [03-03]: PDA derivation uses string seeds matching Anchor IDL
- [03-03]: Anchor IDL discriminator used directly for create_token instruction
- [03-03]: canvas-confetti loaded via dynamic import() to avoid SSR issues
- [03-03]: Token image defaults to creator avatar; custom image optional via toggle
- [03-04]: KYC badge renders nothing for unverified (no stigmatizing "unverified" label)
- [03-04]: Cooldown/sell restriction info private to creator only (not on public profile)
- [03-04]: Vesting timeline calculates from launchedAt with 30d cliff + 60d linear
- [03-04]: Public creator profile is server component for SEO
- [04-01]: Soft-delete posts (status=removed) for legal compliance -- never hard delete
- [04-01]: Text-only posts publish immediately; posts with media check all media ready status
- [04-01]: Draft visibility restricted to owner; published posts are public
- [04-02]: Synchronous scan+process in confirm request (acceptable for MVP, Sharp < 5s for 25MB)
- [04-02]: Original image preserved in R2 (never deleted after processing)
- [04-02]: Responsive variants: sm(400px), md(800px), lg(1200px) as WebP quality 80
- [04-02]: Content media key pattern: content/{creatorProfileId}/{mediaId}/original.{ext}
- [04-03]: Two-phase video upload: R2 first (CSAM scan), then Mux (transcoding)
- [04-03]: video_quality: basic and max_resolution_tier: 1080p for cost control
- [04-03]: Mux SDK lacks max_duration_seconds on upload params; enforce via dashboard or post-transcoding
- [04-03]: Always return 200 after Mux webhook signature verification to prevent retry storms
- [04-05]: Reuse kycStatus="suspended" for strike 3 consequence (no new schema column)
- [04-05]: Admin check via ADMIN_EMAILS env var for MVP (no roles table)
- [04-05]: Soft-delete cascade marks attached media as "failed" (preserved in R2)
- [04-05]: 3-strike system: warning -> 7-day restriction -> suspension

### Pending Todos

- Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET for Google OAuth
- Set TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET for Twitter OAuth
- Fund devnet wallet and deploy program (when airdrop faucet available)
- Configure Cloudflare R2 for image uploads (see 03-USER-SETUP.md)
- Configure Sumsub KYC credentials (see 03-USER-SETUP.md)
- Set HIVE_CSAM_API_KEY for CSAM scanning (contact sales@thehive.ai)
- Set MUX_TOKEN_ID, MUX_TOKEN_SECRET, MUX_WEBHOOK_SECRET for Mux video
- Configure Mux webhook endpoint pointing to /api/webhooks/mux
- Set ADMIN_EMAILS env var with comma-separated admin email addresses

### Blockers/Concerns

- Phase 4 needs phase-level research (PhotoDNA access, NCMEC reporting, video transcoding)
- Audit firm selection needed before Phase 2 smart contract can go to mainnet
- Vesting weekly snapping leaves ~6.7% of allocation permanently locked (design decision to document)

## Session Continuity

Last session: 2026-02-01
Stopped at: Completed 04-05-PLAN.md
Resume file: None
