# Project Research Summary

**Project:** Baremint
**Domain:** Crypto-native creator platform (Solana bonding curves + token-gated content)
**Researched:** 2026-01-31
**Confidence:** MEDIUM-HIGH

## Executive Summary

Baremint is a creator platform that combines OnlyFans-style content monetization with pump.fun-style token economics. Creators launch Solana tokens on permanent bonding curves and gate content behind token holdings. Viewers buy tokens to access content, burn tokens for premium unlocks, and benefit from price appreciation as the creator's token gains value. The core innovation is custodial wallet UX (no MetaMask required) with a dual-revenue model: creators earn from both token burns and a percentage of secondary trading fees.

The recommended approach is a three-tier architecture: Next.js 16 full-stack app, custom Anchor program for bonding curve logic, and external services (Helius RPC, Cloudflare R2 for media, Sumsub for KYC). Critical stack choices include Neon Postgres + Drizzle ORM (serverless performance), Better Auth (official successor to NextAuth), @solana/kit 3.0 (modern Solana SDK), and Cloudflare R2 (zero egress fees crucial for media-heavy platforms). The existing Next.js 16 codebase provides a strong foundation; primary gaps are database integration, authentication system, Solana program development, and content infrastructure.

The dominant risks are custodial wallet security (key management is a single point of failure), bonding curve smart contract vulnerabilities (Solana-specific attack vectors), and content moderation liability (CSAM is an existential legal risk). These must be addressed in Phase 1 foundations — retrofitting security after launch is catastrophically complex. Anti-rug protections (KYC + 30-day cliff + 60-day vesting + 90-day cooldown) are differentiators but require careful economic modeling to prevent soft rug pulls via curve design.

## Key Findings

### Recommended Stack

The stack is anchored by Next.js 16 (already installed) with React Server Components for optimal performance. Database choice is Neon Postgres with Drizzle ORM — serverless architecture with scale-to-zero, instant branching for dev/staging, and superior cold-start performance versus Prisma (critical for serverless routes). Better Auth replaces NextAuth as the official recommendation from the Auth.js team (joined Better Auth in Sept 2025). Cloudflare R2 provides S3-compatible storage with zero egress fees — massive cost savings for a media-heavy platform (R2: $15/month for 10TB egress vs S3: $891/month).

**Core technologies:**
- **Neon Postgres + Drizzle ORM**: Serverless database with instant branching, ~7kb bundle, zero dependencies, native Neon driver support
- **Better Auth**: TypeScript-first authentication with database sessions, built-in Drizzle adapter, credential auth first-class (vs Auth.js v5 which is now maintenance-only)
- **@solana/kit 3.0**: Official successor to @solana/web3.js v1, tree-shakable, ~30% smaller bundles, zero dependencies, native BigInt
- **@helius-dev/kite 1.0**: High-level Solana helpers built on Kit, one-shot functions for common tasks, reduces boilerplate significantly
- **Cloudflare R2**: Zero egress fees for media delivery (20-40% faster than S3 via edge network), S3-compatible API using @aws-sdk/client-s3
- **Anchor 0.32.1**: Solana program framework for bonding curve smart contract, de facto standard with account validation and testing infrastructure
- **Sumsub**: KYC provider with blockchain analysis, Travel Rule compliance, Gartner Magic Quadrant Leader for crypto use cases

**Critical compatibility note:** Anchor's TypeScript client is NOT compatible with @solana/kit — use Codama to generate Kit-compatible clients from Anchor IDLs, or use Kite which integrates with Codama-generated clients.

**Security foundation:** AES-256-GCM encryption for custodial wallet private keys using Node.js crypto (built-in), with encryption key stored in environment variable initially and migrating to KMS (AWS/GCP) for production. Keys decrypted only in-memory for transaction signing, then zeroed.

### Expected Features

Research identified 15 table stakes features (missing any feels broken), 10+ differentiators, and 12 anti-features to deliberately avoid. The MVP scope centers on proving the token-gated content model with minimal complexity.

**Must have (table stakes):**
- Creator profiles with bio, avatar, social links, token stats
- Content feed (images, video, text) with upload pipeline and CDN delivery
- Content access gating (hold-threshold for feed access)
- Pay-per-view / premium content (burn-to-unlock is Baremint's PPV equivalent)
- Token leaderboard / rankings (market cap, volume, trending)
- Creator earnings dashboard (burns, trade fees, tips, total revenue)
- Email/password + social login authentication with custodial wallet creation on signup
- KYC for creators (third-party provider, required before token launch)
- Content moderation with CSAM detection (PhotoDNA hash-matching, NCMEC reporting)
- Mobile-responsive web (most OnlyFans traffic is mobile, PWA not native app)
- Wallet balance display and withdrawal to external wallet
- Token launch flow (one-click deploy: name, ticker, image → SPL token + bonding curve)
- Bonding curve buy/sell with transparent pricing and slippage protection
- Transaction history with human-readable descriptions
- Anti-rug protections visibly shown (vesting schedule, creator allocation, cooldowns)

**Should have (competitive differentiators):**
- Burn-to-unlock content model (deflationary pressure, aligns viewer and holder incentives) — this IS the core differentiator
- Permanent bonding curve (vs pump.fun graduation to DEX which causes dump events)
- Custodial wallet abstraction (crypto economics with Web2 UX, no seed phrases or gas fees visible)
- Creator token economy (dual revenue: burns + trade fees, early supporter price appreciation)
- Anti-rug protection system (KYC + 10% allocation + 30-day cliff + 60-day vest + 90-day cooldown)
- Token-holder tiers (multiple access levels: 100 tokens for feed, 500 for DMs, burn 50 for premium)
- Creator analytics (token velocity, holder count, burn rate, revenue per post)
- Token price alerts and referral system with fee sharing

**Defer (v2+):**
- Real-time chat/DMs (massive moderation burden, defer until proven model)
- Fiat on/off ramp (regulatory complexity, partner integration post-PMF)
- Livestreaming (technical complexity, not core to proving burn-to-unlock model)
- Token-gated comments and community features
- Governance/voting (creates entitled community dynamics, tokens are for access not governance)

**Anti-features (deliberately avoid):**
- DEX graduation/liquidity migration (fragments liquidity, causes dump events)
- Airdrops/free token distribution (friend.tech's airdrop caused 98% crash, attracts dumpers)
- Complex DeFi features (staking, yield, LP) — alienates target audience, massive smart contract risk
- Anonymous creator launches (every token is a potential rug without KYC)
- On-chain content storage (IPFS/Arweave makes moderation impossible, expensive, slow)
- Content DRM (false security, wastes engineering effort)
- Native mobile app v1 (app store crypto trading restrictions, 30% Apple tax)

**Key insight — Two Audience Challenge:** Baremint serves content consumers (expect easy signup, content feed, payment simplicity) AND crypto traders (expect price charts, trading UI, leaderboards). The custodial wallet strategy addresses this but requires building two interaction layers: a "content view" (feed, unlock, enjoy) and a "token holder view" (chart, trade, portfolio).

### Architecture Approach

Three-tier system with clear boundaries: Next.js 16 frontend/backend (Server Components + Server Actions), custom Anchor Solana program (on-chain bonding curve logic), and external services (Helius RPC/webhooks, R2 storage, Sumsub KYC). The critical architectural boundary is on-chain state (token supply, reserves, SOL balances — trustless) versus off-chain state (user profiles, content metadata, encrypted keys, KYC records — trusted platform). The on-chain state is the source of truth; the off-chain database is a read cache updated via Helius webhooks.

**Major components:**
1. **Frontend Layer (Next.js App Router)** — Server Components for static content, Client Components for interactive trading UI, Server Actions for all mutations (no raw fetch), minimal client state
2. **Server Layer (Backend-for-Frontend)** — Authentication, transaction construction and signing (decrypts wallet keys server-side, builds Solana txs, signs, submits via Helius), content access control (verifies token balance via Helius DAS API before serving signed URLs), webhook ingestion (Helius events update off-chain state), KYC orchestration
3. **Database Layer (Postgres)** — User accounts, encrypted wallet keys (AES-256-GCM with KMS key), creator profiles, tokens, vesting schedules, posts with access rules, off-chain transaction mirror (fast queries, on-chain is source of truth), content access logs
4. **Solana Program (Anchor/Rust)** — GlobalConfig PDA (platform settings), BondingCurve PDA per token (reserves, creator address), CreatorVault PDA (fee earnings), VestingAccount PDA (creator allocation with cliff/vest), instructions (initialize, create_token, buy, sell, burn_for_access, claim_vested, withdraw_fees, donate)
5. **External Services** — Helius RPC (transaction submission), Helius DAS API (token balance queries for gating), Helius webhooks (push notifications for on-chain events), Cloudflare R2/S3 (media storage with presigned URLs), Sumsub (creator KYC verification)

**Key patterns to follow:**
- Server-side transaction signing (custodial): All Solana transactions built and signed on Next.js server, users never interact with keys
- Webhook-driven state sync: Helius webhooks keep off-chain DB in sync with on-chain state (eliminates polling)
- Signed URL content delivery: Never expose permanent media URLs, generate short-lived signed URLs (15-min TTL) after verifying token holdings
- Optimistic UI with confirmation: Show transaction as "pending" immediately, update to "confirmed" when webhook arrives
- Balance caching with short TTL: Cache Helius DAS API balance responses for 30-60s to avoid excessive RPC calls on feed pages

**Anti-patterns to avoid:**
- Client-side balance checks for access control (trivially bypassed)
- Storing raw private keys unencrypted (single DB breach exposes all funds)
- On-chain content storage (expensive, slow, makes moderation impossible)
- Single global fee wallet (accounting nightmare)
- Synchronous transaction confirmation in UI (feels frozen even at 400ms Solana finality)

### Critical Pitfalls

Research identified 12 domain-specific pitfalls with 5 classified as CRITICAL (existential risk or total platform compromise).

1. **Custodial Key Storage as Honeypot** — AES-256 encrypted keys in same database/server as encryption keys. Single breach yields both ciphertext and decryption key. Bybit, KuCoin, Upbit ($36M Solana), Atomic Wallet ($35M) all suffered this. Prevention: HSM/KMS for encryption keys (AWS KMS, GCP Cloud HSM), envelope encryption (master key encrypts data encryption keys), memory-safe key handling (zero keys after use), MPC wallets for production. Must be addressed Phase 1 — retrofitting key management post-launch means migrating every wallet.

2. **Bonding Curve Smart Contract Vulnerabilities** — Solana protocols lost $450M+ (2021-2025) to exploits, 85.5% from business logic, permissions, validation errors. Missing signer/owner checks, integer overflow, arbitrary CPI targets, stale data after CPI. Prevention: Anchor framework with overflow-checks=true, validate every account passed to every instruction (signer, owner, data), use checked_* math operations, canonical PDA bumps, reload() accounts after CPIs, professional Solana-specific audit before mainnet, formal verification for bonding curve math, bug bounty program. Audit must gate mainnet deployment.

3. **MEV Sandwich Attacks on Bonding Curve Trades** — $370-500M extracted on Solana over 16 months, 100+ victims/hour. Bonding curves with deterministic pricing are trivially sandwichable. 93% of attacks now multi-slot wide sandwiches evading single-slot detection. Prevention: Slippage protection with sensible defaults, linearly decaying sniper tax during initial price discovery (6-second decay as Heaven platform does), MEV-protection tx submission (Jito bundles, bloXroute leader-aware routing) as default RPC path, max single-trade size limits, display estimated price impact prominently. Must be in bonding curve design phase.

4. **CSAM and Illegal Content on Creator Platform** — Section 230 does NOT protect from federal CSAM liability. Strict liability for mere possession. Crypto payments to CSAM addresses increased 130% (2022-2024), one crypto CSAM transaction every two minutes. Creator platforms with paid content attract commercial CSAM distribution. Prevention: Automated PhotoDNA/perceptual hashing on ALL uploads BEFORE accessible (even gated), NCMEC reporting (18 U.S.C. 2258A mandatory), KYC for creators before uploads, human review pipeline for flagged content, content type restrictions in early phases, retain hashes for law enforcement. Must be in Phase 1 alongside content upload — never launch uploads without scanning.

5. **KYC Data as Liability Magnet** — 8.6M KYC records compromised in 2024 across two exchanges, 42% of exchanges cite securing KYC data as "major issue." Government IDs + wallet addresses enable targeted phishing, SIM-swap, physical threats. GDPR fines up to 4% revenue or 20M EUR. 86% of enforcement actions (2019-2024) triggered by KYC non-compliance. Prevention: Third-party KYC provider (Jumio, Sumsub, Onfido) — let them hold PII liability, store only pass/fail status + provider reference ID, separate database for any stored PII with separate encryption keys, data minimization, GDPR right-to-erasure from day one, retention policy per jurisdiction, access logging. Never store KYC data and wallet keys in same database. Architect data separation before integrating KYC provider.

**Additional moderate pitfalls:**
- Token-gated content access control bypass (verify balance at content access time, not just login)
- Bonding curve economics enabling soft rug pulls (simulate creator 10% allocation sell impact, daily sell caps even post-vesting)
- Platform fee accounting drift (on-chain as source of truth, reconciliation jobs, integer arithmetic only, handle partial transaction failures)
- SIM-swap and account takeover attacks (TOTP/WebAuthn only, no SMS 2FA, withdrawal delays with multi-channel alerts)

## Implications for Roadmap

Based on dependency analysis and critical-path identification, suggested phase structure groups foundational systems first, then layered features. Security-critical components (wallet encryption, smart contract audit, content moderation) must be complete before dependent features ship.

### Phase 1: Foundation & Security
**Rationale:** Authentication, custodial wallets, and database infrastructure are dependencies for everything else. Key management must be architected correctly from day zero — retrofitting is catastrophically complex. This phase de-risks the highest-severity pitfalls before writing feature code.

**Delivers:** Users can sign up (email/password + social OAuth), get a custodial Solana wallet (encrypted with AES-256-GCM + KMS key), view their public wallet address, deposit SOL from external wallets.

**Stack:** Neon Postgres + Drizzle ORM for database, Better Auth for authentication with Drizzle adapter, Node.js crypto for AES-256-GCM encryption with environment variable key (migrate to AWS KMS before production).

**Addresses:**
- Table stakes: User authentication, wallet balance display
- Differentiator: Custodial wallet abstraction

**Avoids:**
- Pitfall #1 (Custodial Key Storage): Implements KMS-based key management from start
- Pitfall #9 (SIM-swap attacks): TOTP/WebAuthn 2FA, no SMS-based auth

**Research flags:** Standard patterns (NextAuth → Better Auth migration documented, Drizzle + Neon setup guides available). No phase-level research needed.

### Phase 2: Bonding Curve Smart Contract
**Rationale:** The Solana program is the financial core. It must be audited before mainnet deployment, which takes 2-4 weeks minimum. Starting development early allows audit to happen in parallel with frontend features. Smart contract development is the longest-lead-time item and blocks token launch features.

**Delivers:** Anchor program deployed to devnet with GlobalConfig, BondingCurve PDA structure, buy/sell/burn instructions, CreatorVault/PlatformVault fee distribution, VestingAccount with cliff/vest logic. Test suite with 80%+ coverage. Program ready for audit.

**Stack:** Anchor Framework 0.32.1, Rust with overflow-checks=true, Solana devnet for testing.

**Addresses:**
- Table stakes: Bonding curve with transparent pricing, buy/sell tokens, anti-rug protections (vesting on-chain)
- Differentiator: Permanent bonding curve (no graduation), burn-to-unlock mechanics

**Avoids:**
- Pitfall #2 (Smart Contract Vulnerabilities): Anchor with all safety features, validates every account, uses checked_* math, audit-ready
- Pitfall #3 (MEV Sandwich Attacks): Slippage protection in instruction design, sniper tax for initial price discovery
- Pitfall #7 (Soft Rug Pull Economics): Simulate creator 10% allocation sell impact before finalizing curve parameters

**Research flags:** NEEDS PHASE-LEVEL RESEARCH. Topics: Anchor program architecture patterns, bonding curve math verification, PDA design for multi-token platform, Solana-specific audit requirements. Reference implementations exist (m4rcu5o/pumpfun-fork, rally-dfs/bonding-curve) but need adaptation for permanent curve model and burn mechanics.

### Phase 3: Creator Onboarding & Token Launch
**Rationale:** With wallets (Phase 1) and smart contract (Phase 2) complete, creators can now launch tokens. KYC verification is the compliance gate. This phase proves the token economy before adding content complexity.

**Delivers:** Creator profile creation, Sumsub KYC integration with webhook for async verification, token launch flow (name, ticker, image upload → create_token instruction), 90-day cooldown enforcement, creator vesting dashboard showing claimable tokens.

**Stack:** Sumsub SDK for KYC (Web SDK for flow, REST API for verification status checks), @solana/kit + @helius-dev/kite for transaction construction, Cloudflare R2 for token image storage, Metaplex Token Metadata for SPL token metadata.

**Addresses:**
- Table stakes: Creator profiles, KYC for creators, token launch flow, vesting schedule visibility
- Differentiator: Anti-rug protection layer (KYC + vesting + cooldown enforced)

**Avoids:**
- Pitfall #5 (KYC Data Liability): Third-party provider (Sumsub), store only pass/fail status + reference ID, separate PII database if any stored
- Pitfall #12 (Token Spam): KYC gate prevents throwaway accounts, 90-day cooldown prevents rapid launches

**Research flags:** Moderate complexity. Topics: Sumsub integration patterns, Metaplex Token Metadata v3 with Umi framework, Codama for generating Kit-compatible clients from Anchor IDL. Documentation exists but integration may have edge cases.

### Phase 4: Content Upload & Moderation
**Rationale:** Content infrastructure depends on authentication (Phase 1) and storage setup. Content moderation is a legal requirement that cannot be deferred — must be operational before ANY user-generated content goes live. This phase is blocking for content gating features.

**Delivers:** Image upload with resize/optimization (Sharp), video upload with transcoding (consider external service vs in-house), presigned R2 upload URLs for client-direct uploads, automated CSAM scanning (PhotoDNA or equivalent hash-matching), manual review queue for flagged content, NCMEC reporting pipeline, content moderation dashboard for admins.

**Stack:** Cloudflare R2 with @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner, Sharp for image processing, PhotoDNA API or equivalent for CSAM detection, BullMQ + Redis for async job queue (video transcoding, content scanning).

**Addresses:**
- Table stakes: Content feed (images, video, text), content moderation / CSAM detection, mobile-responsive web (image/video delivery)

**Avoids:**
- Pitfall #4 (CSAM Liability): PhotoDNA scanning before content accessible, NCMEC reporting, KYC for creators already in place
- Pitfall #11 (Media Storage Cost Explosion): Upload limits, hash-based deduplication, transcode to standard formats

**Research flags:** NEEDS PHASE-LEVEL RESEARCH. Topics: PhotoDNA API integration (Microsoft provider vs alternatives), NCMEC CyberTipline reporting requirements (18 U.S.C. 2258A), video transcoding options (AWS MediaConvert vs Cloudflare Stream vs open-source), presigned URL security patterns for token-gated content.

### Phase 5: Token-Gated Content Access
**Rationale:** With content pipeline (Phase 4) and tokens (Phases 2-3) operational, this phase implements the core product value: hold tokens to access creator content. This proves the token-gating model before adding burn mechanics.

**Delivers:** Creator content posting with access level selection (public/gated/premium), token balance verification via Helius DAS API (getAssetsByOwner), short-lived signed URLs (15-min TTL) for gated content, blurred placeholder + "Hold X tokens to unlock" for inaccessible posts, content access logging, balance caching (30-60s TTL).

**Stack:** Helius DAS API for token balance queries, Next.js Server Components for access-controlled rendering, R2 signed URLs with expiration.

**Addresses:**
- Table stakes: Content access gating (hold-threshold)
- Differentiator: Token economy (hold for access)

**Avoids:**
- Pitfall #6 (Access Control Bypass): Real-time balance checks at content access time, signed URLs with short TTL, server-side enforcement only
- Pitfall #10 (RPC Reliability): Helius dedicated RPC with SLA, DAS API caching, failover logic

**Research flags:** Standard patterns (Helius DAS API documented, token gating tutorial exists). No phase-level research needed.

### Phase 6: Token Trading & Economy
**Rationale:** With gating proven (Phase 5), this phase adds the trading features that complete the dual-revenue model. Server-side transaction signing (established in Phase 1) is reused for buy/sell operations.

**Delivers:** Buy/sell tokens via bonding curve (Server Actions with transaction signing), slippage protection UI with sensible defaults, price chart showing bonding curve math, transaction history with human-readable descriptions, real-time price display (websocket or 30s polling), token leaderboard (market cap, volume, trending), portfolio view (holdings across all creators).

**Stack:** @solana/kit + @helius-dev/kite for transaction construction, Helius webhooks to update off-chain transaction ledger, chart library (recharts or lightweight-charts), real-time price via DAS API or websocket subscription.

**Addresses:**
- Table stakes: Buy/sell tokens, bonding curve pricing, transaction history, token leaderboard, wallet withdrawal to external address
- Differentiator: Permanent bonding curve with deterministic pricing

**Avoids:**
- Pitfall #8 (Accounting Drift): On-chain as source of truth, reconciliation jobs, Helius webhooks for confirmed transactions, integer arithmetic only

**Research flags:** Moderate complexity. Topics: Helius webhook signature verification, real-time price update patterns (websocket vs polling), chart library for bonding curve visualization. Documentation available but integration requires validation.

### Phase 7: Burn-to-Unlock Premium Content
**Rationale:** This is the key differentiator that sets Baremint apart from hold-gated competitors. It depends on the bonding curve (Phase 2), content pipeline (Phase 4), and gating infrastructure (Phase 5). This phase proves the deflationary tokenomics model.

**Delivers:** Premium/PPV post type with burn cost, burn_for_access instruction integration, content_access_log for permanently unlocked posts, burn transaction confirmation with SOL return calculation, creator earnings dashboard showing burn revenue, burn-to-unlock UI with clear value proposition ("Burn 50 tokens to unlock, remaining holders see price increase").

**Stack:** burn_for_access Anchor instruction (already implemented in Phase 2 smart contract), Server Action for burn transactions, Helius webhooks to confirm burns.

**Addresses:**
- Table stakes: Pay-per-view / premium content
- Differentiator: Burn-to-unlock content model (deflationary pressure, aligns incentives)

**Avoids:**
- Pitfall #7 (Soft Rug Pull): Burn revenue flows to creator, reducing need to sell vested allocation

**Research flags:** Standard patterns (reuses Phase 6 transaction signing, Phase 5 content delivery). No phase-level research needed.

### Phase 8: Creator Monetization & Earnings
**Rationale:** With all revenue streams operational (burns, trade fees), this phase gives creators visibility into earnings and enables withdrawals. Creator retention depends on clear earnings visibility.

**Delivers:** Creator earnings dashboard (burns, trade fee percentage, tips, total revenue), token price chart on creator profile, withdraw_creator_fees instruction integration, SOL withdrawal to external wallet for creators, donation system (SOL + token tips via donate_sol and donate_token instructions).

**Stack:** Helius webhooks for fee accumulation tracking, withdraw_creator_fees Anchor instruction, Server Action for withdrawals.

**Addresses:**
- Table stakes: Creator earnings dashboard, withdrawal to external wallet
- Differentiator: Dual revenue model (burns + trade fees)

**Avoids:**
- Pitfall #8 (Accounting Drift): On-chain CreatorVault PDAs as source of truth for earnings

**Research flags:** Standard patterns. No phase-level research needed.

### Phase 9: Discovery & Growth
**Rationale:** With core features complete, this phase optimizes user acquisition and retention. Discovery features require a critical mass of creators and tokens to be useful.

**Delivers:** Search by creator name, category/tag filtering, trending algorithm (volume + holder count + recency), creator analytics dashboard (token velocity, holder count, burn rate, revenue per post), token price alerts (notify when target hit), notifications (creator posts, token price changes, content unlocks), referral system with fee sharing.

**Stack:** Postgres full-text search or Algolia for creator search, notification system (push notifications via web push API, email digests), analytics aggregation from on-chain data.

**Addresses:**
- Table stakes: Creator discovery / search, notifications
- Differentiator: Creator analytics (token metrics), social proof / holder badges, referral system

**Avoids:**
- Pitfall #12 (Token Spam): Creator reputation scoring based on activity and holder satisfaction

**Research flags:** Standard patterns (search, notifications, analytics dashboards). No phase-level research needed.

### Phase Ordering Rationale

**Security-first approach:** Phases 1-2 (auth/wallets + smart contract) address the three CRITICAL pitfalls (key storage, smart contract vulnerabilities, MEV attacks) before building features on top. This is intentional — security cannot be retrofitted.

**Dependency-driven sequencing:** Each phase unlocks the next based on technical dependencies identified in ARCHITECTURE.md:
- Auth → Wallets (Phase 1) enables all on-chain operations
- Smart Contract (Phase 2) must be audit-ready before mainnet, longest lead time
- Token Launch (Phase 3) requires wallets + smart contract + KYC
- Content Upload (Phase 4) + Moderation must precede any content features
- Gating (Phase 5) requires content pipeline + tokens
- Trading (Phase 6) and Burns (Phase 7) layer on proven gating infrastructure
- Monetization (Phase 8) requires all revenue streams operational
- Discovery (Phase 9) optimizes after core features proven

**MVP boundary:** Phases 1-7 constitute the MVP that proves the burn-to-unlock model. Phases 8-9 are fast-follow for creator retention and growth. A functional MVP requires: users can sign up, creators can launch tokens, creators can post content, viewers can buy tokens to access gated content and burn tokens to unlock premium content.

**Pitfall mitigation integrated:** Each phase explicitly addresses relevant pitfalls from PITFALLS.md. The 5 CRITICAL pitfalls are all mitigated in Phases 1-4, gating mainnet launch.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 2 (Bonding Curve Smart Contract):** Complex domain with Solana-specific security requirements. Topics: Anchor program architecture patterns for multi-token platform, bonding curve math formal verification, PDA design optimization, Solana audit process and auditor selection criteria. Reference implementations exist but require adaptation.

- **Phase 4 (Content Upload & Moderation):** Legal compliance domain with sparse open documentation. Topics: PhotoDNA API integration patterns, NCMEC CyberTipline reporting workflow (18 U.S.C. 2258A), video transcoding service evaluation (AWS MediaConvert vs Cloudflare Stream vs open-source FFmpeg), presigned URL security for token-gated content with short TTLs.

- **Phase 6 (Token Trading):** Integration complexity with multiple external services. Topics: Helius webhook signature verification and retry logic, real-time price update architecture (websocket vs polling trade-offs), bonding curve chart visualization libraries (lightweight-charts vs recharts).

Phases with standard patterns (skip research):

- **Phase 1 (Foundation):** Better Auth migration from NextAuth well-documented, Drizzle + Neon setup guides available, AES-256-GCM encryption standard practice.
- **Phase 3 (Creator Onboarding):** Sumsub integration documented, Metaplex Token Metadata v3 official docs, KYC flow patterns established.
- **Phase 5 (Content Gating):** Helius DAS API documented with token gating tutorial, Next.js Server Components for access control standard pattern.
- **Phase 7 (Burn-to-Unlock):** Reuses Phase 6 transaction signing patterns and Phase 5 content delivery, no new integration points.
- **Phase 8 (Monetization):** Standard wallet withdrawal patterns, earnings dashboard is data aggregation.
- **Phase 9 (Discovery):** Search, notifications, analytics are well-documented domains.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core technologies (@solana/kit, Anchor, Drizzle, Better Auth) have official documentation and active maintenance. Better Auth as NextAuth successor is confirmed by Auth.js team announcement. R2 zero-egress cost savings is documented by Cloudflare with benchmarks. Neon serverless Postgres performance claims verified by multiple independent sources. |
| Features | MEDIUM-HIGH | Table stakes identified from competitive analysis (OnlyFans, Patreon, Fansly, pump.fun, friend.tech). Burn-to-unlock as differentiator is novel — no direct competitors — so market validation is assumption-based. Two-audience challenge (content consumers + crypto traders) is real but custodial wallet strategy addresses known pain points from friend.tech (required MetaMask). |
| Architecture | HIGH | Three-tier architecture (Next.js BFF + Anchor program + external services) is standard for custodial web3 apps. Bonding curve PDA structure directly informed by pump.fun open-source implementations. Signed URL content delivery is standard cloud storage pattern. Webhook-driven state sync is documented Helius pattern. Build order dependency graph validated against multiple sources. |
| Pitfalls | HIGH | All 5 CRITICAL pitfalls verified with real-world breach post-mortems (Upbit $36M Solana breach, friend.tech SIM-swap attacks, Solana $450M+ exploit history). CSAM liability backed by federal law (18 U.S.C. 2258A) and industry reports (Chainalysis crypto CSAM data). MEV sandwich attack data from Helius official report ($370-500M extracted). KYC data breach statistics from industry sources (8.6M records compromised 2024). Bonding curve vulnerabilities confirmed by Solana Foundation security course and Sec3 2025 ecosystem review. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

**Economic simulation required:** Bonding curve parameters (initial reserves, curve shape, creator 10% allocation impact) must be simulated with adversarial scenarios before smart contract implementation. The research identifies the risk (Pitfall #7: soft rug pulls) but does not provide specific curve formulas or reserve ratios. Phase 2 planning must include economic modeling with tools like Desmos or Python simulations to validate that creator selling full vested allocation does not crash price below acceptable thresholds.

**Audit firm selection criteria:** Research confirms Solana-specific audit is mandatory but does not recommend specific firms or evaluation criteria. Phase 2 planning must research auditors (Sec3, Neodyme, OtterSec, Zellic) with Solana expertise, pricing models (fixed vs per-line-of-code), and typical timelines (2-4 weeks). Budget 20-50K USD based on industry estimates.

**PhotoDNA API access:** Content moderation research confirms PhotoDNA hash-matching is the standard for CSAM detection but does not detail the API access process. Microsoft's PhotoDNA is not publicly available — requires application process for nonprofits/platforms. Phase 4 planning must evaluate alternatives (Thorn, NCMEC Hash Database, CloudSight AI) if Microsoft PhotoDNA access is delayed.

**MEV protection cost-benefit analysis:** Research recommends Jito bundles and bloXroute leader-aware routing for MEV protection but does not quantify cost impact. Jito bundles may have 10-20% additional cost vs standard RPC. Phase 6 planning must evaluate whether MEV protection is default for all trades or opt-in for large trades, and model cost impact on platform economics.

**KYC flow customization:** Sumsub recommended based on crypto-native features but research does not detail flow customization for creator-specific requirements (e.g., verifying creator controls the social media account they claim). Phase 3 planning must design KYC flow with Sumsub's no-code builder: government ID verification + liveness check + wallet address ownership proof + social account verification (optional but valuable for creator authenticity).

**Video transcoding service decision:** Research notes video upload is higher complexity but does not recommend specific transcoding approach. Phase 4 planning must decide: AWS MediaConvert (powerful, complex, higher cost), Cloudflare Stream (simple, integrated with R2, moderate cost, newer), or open-source FFmpeg (lowest cost, requires infrastructure management). Decision depends on budget and engineering capacity.

## Sources

### Primary (HIGH confidence)

**Solana & Web3 Stack:**
- [@solana/kit npm](https://www.npmjs.com/package/@solana/kit) — v3.0.3 official SDK, successor to @solana/web3.js
- [Anza: Solana JS SDK 2.0 Release](https://www.anza.xyz/blog/solana-web3-js-2-release) — official announcement, migration guide
- [Anchor Framework Docs](https://www.anchor-lang.com/docs) — v0.32.1 program development
- [Anchor Releases](https://github.com/solana-foundation/anchor/releases) — version tracking
- [Metaplex Token Metadata](https://developers.metaplex.com/token-metadata) — JS client v3.4.0
- [@helius-dev/kite npm](https://www.npmjs.com/package/@helius-dev/kite) — v1.0.1 high-level helpers
- [Helius DAS API Documentation](https://www.helius.dev/docs/das-api) — token balance queries
- [Helius Platform](https://www.helius.dev) — RPC, webhooks, DAS API

**Database & Auth:**
- [Drizzle ORM npm](https://www.npmjs.com/package/drizzle-orm) — v0.45.1 stable
- [Drizzle + Neon setup](https://orm.drizzle.team/docs/connect-neon) — official integration guide
- [Better Auth Next.js integration](https://www.better-auth.com/docs/integrations/next) — framework setup
- [Better Auth installation](https://www.better-auth.com/docs/installation) — getting started
- [Auth.js joins Better Auth discussion](https://github.com/nextauthjs/next-auth/discussions/13252) — official team announcement

**Storage & CDN:**
- [Cloudflare R2 S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/) — S3-compatible integration
- [R2 performance benchmarks](https://blog.cloudflare.com/r2-is-faster-than-s3/) — 20-40% faster delivery

**Security & Compliance:**
- [Helius: Solana Hacks Complete History](https://www.helius.dev/blog/solana-hacks) — $450M+ exploit data
- [Helius: Hitchhiker's Guide to Solana Program Security](https://www.helius.dev/blog/a-hitchhikers-guide-to-solana-program-security) — vulnerability patterns
- [Sec3: Solana Security Ecosystem Review 2025](https://solanasec25.sec3.dev/) — 85.5% business logic finding
- [Solana Foundation: Signer Authorization Course](https://solana.com/developers/courses/program-security/signer-auth) — security patterns
- [Solana Foundation: Owner Checks Course](https://solana.com/developers/courses/program-security/owner-checks) — account validation
- [Helius: Solana MEV Report](https://www.helius.dev/blog/solana-mev-report) — $370-500M MEV extraction data
- [Chainalysis: CSAM and Cryptocurrency](https://www.chainalysis.com/blog/csam-cryptocurrency-monero-instant-exchangers-2024/) — 130% increase crypto CSAM payments

### Secondary (MEDIUM confidence)

**Competitive Analysis:**
- [OnlyFans Pricing Guide 2025](https://onlysonar.com/blog/onlyfans-pricing-guide) — PPV pricing patterns
- [OnlyFans 2025 Features](https://www.thebluetalent.com/blog/the-future-of-onlyfans-2025-upcoming-features-and-monetization-tactics) — feature expectations
- [Pump.fun Overview](https://beincrypto.com/learn/what-is-pump-fun/) — bonding curve mechanics
- [Friend.tech Shutdown](https://finance.yahoo.com/news/social-platform-friend-tech-shuts-065105515.html) — failure analysis
- [SocialFi Lessons Learned](https://cointelegraph.com/news/friendtech-failure-socialfi-success-adoption) — what went wrong

**Technical Comparisons:**
- [Drizzle vs Prisma comparison (Bytebase)](https://www.bytebase.com/blog/drizzle-vs-prisma/) — ORM performance analysis
- [Cloudflare R2 vs S3 (ThemeDev)](https://themedev.net/blog/cloudflare-r2-vs-aws-s3/) — cost comparison
- [Neon Postgres overview (Bytebase)](https://www.bytebase.com/blog/neon-vs-supabase/) — serverless database comparison
- [Kite + Codama for Anchor programs](https://solanakite.org/docs) — Kit-compatible client generation

**Architecture Patterns:**
- [Helius Blog: Token Gating on Solana](https://www.helius.dev/blog/token-gating-on-solana-mobile-tutorial) — DAS API usage
- [Pump.fun Bonding Curve Mechanism (DeepWiki)](https://deepwiki.com/pump-fun/pump-public-docs/3.1-pump-bonding-curve-mechanism) — PDA architecture

**Incident Reports:**
- [friend.tech SIM-Swap Attacks](https://cryptopotato.com/friend-tech-targeted-again-hacker-steals-234-eth-in-under-24-hours/) — 234 ETH in 24 hours from 4 users
- [Upbit $36M Solana Breach](https://www.ccn.com/education/crypto/upbit-2025-hack-36-million-solana-assets-stolen/) — custodial wallet compromise
- [Fei Protocol Bonding Curve Bug](https://medium.com/fei-protocol/fei-bonding-curve-bug-post-mortem-98d2c6f271e9) — economic vulnerability

**Compliance & KYC:**
- [Sumsub KYC for crypto](https://sumsub.com/kyc-compliance/) — crypto-native KYC features
- [KYC Compliance Statistics 2025](https://coinlaw.io/kyc-compliance-in-crypto-statistics/) — 86% enforcement from KYC non-compliance
- [TechGDPR: GDPR for Blockchain](https://techgdpr.com/industries/gdpr-compliance-for-blockchain-crypto-companies/) — data protection requirements

### Tertiary (LOW confidence — needs validation)

**Reference Implementations:**
- [m4rcu5o/Solana-pumpfun-smart-contract](https://github.com/m4rcu5o/Solana-pumpfun-smart-contract) — Pump.fun fork with bonding curve + Meteora migration (audit before any code reuse)
- [rally-dfs/token-bonding-curve](https://github.com/rally-dfs/token-bonding-curve) — Linear price curve using integral-based pricing
- [seiji0411/bonding_curve](https://github.com/seiji0411/bonding_curve) — Anchor-based bonding curve program

**Emerging Technologies:**
- [@helius-dev/kite v1.0.1](https://www.npmjs.com/package/@helius-dev/kite) — marked as "preview" by Helius, may have bugs, fallback to raw @solana/kit if issues arise
- BullMQ/Redis requirement for async job queue — depends on whether video transcoding is handled in-app or via external service

---

*Research completed: 2026-01-31*
*Ready for roadmap: yes*
