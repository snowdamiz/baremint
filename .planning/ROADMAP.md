# Roadmap: Baremint

## Overview

Baremint delivers a crypto-native creator platform where creators launch SPL tokens on permanent bonding curves and viewers buy/burn tokens to access content. The roadmap progresses from security foundations (auth, wallets, smart contract) through creator onboarding (KYC, token launch) and content infrastructure (uploads, moderation, gating) to the complete token economy (trading, burn-to-unlock, monetization) and finally discovery and growth features. Every phase builds on the last, with the five critical security pitfalls addressed in Phases 1-4 before any user-facing features go live.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Authentication & Wallets** - Users can sign up, log in, and have a custodial Solana wallet
- [x] **Phase 2: Bonding Curve Smart Contract** - On-chain program for token creation, trading, burns, vesting, and fees deployed to devnet
- [x] **Phase 3: Creator Onboarding & Token Launch** - Creators can verify identity, set up profiles, and launch their own token
- [x] **Phase 4: Content Infrastructure** - Creators can upload and manage content with automated moderation
- [ ] **Phase 5: Token-Gated Content** - Viewers holding sufficient tokens can access gated creator content
- [ ] **Phase 6: Token Trading** - Viewers can buy and sell creator tokens with full trading UI
- [ ] **Phase 7: Burn-to-Unlock Premium Content** - Viewers can burn tokens to permanently unlock premium/PPV content
- [ ] **Phase 8: Creator Monetization & Donations** - Creators can view earnings, claim vested tokens, withdraw SOL, and receive tips
- [ ] **Phase 9: Discovery & Notifications** - Users can browse, search, and rank creators, and receive activity notifications

## Phase Details

### Phase 1: Authentication & Wallets
**Goal**: Users can securely create accounts and interact with a custodial Solana wallet without any crypto knowledge
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07
**Success Criteria** (what must be TRUE):
  1. User can create an account with email/password and log in across browser sessions
  2. User can sign up or log in via Google or Twitter OAuth
  3. User can enable TOTP-based two-factor authentication on their account
  4. User sees a Solana wallet address and SOL balance on their dashboard immediately after signup
  5. User can withdraw SOL to an external Solana wallet address and see the transaction confirmed
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md -- Database schema, Drizzle ORM, Better Auth email/password, split-screen auth UI, route protection
- [x] 01-02-PLAN.md -- Custodial wallet creation on signup, AES-256-GCM encryption, dashboard wallet widget with balance
- [x] 01-03-PLAN.md -- Google/Twitter OAuth, TOTP 2FA setup and enforcement, SOL withdrawal flow with address book

### Phase 2: Bonding Curve Smart Contract
**Goal**: A fully tested Anchor program on devnet implements token creation, buy/sell via bonding curve, burn-for-access, vesting, and fee distribution
**Depends on**: Nothing (can run in parallel with Phase 1)
**Requirements**: SAFE-01, SAFE-02
**Success Criteria** (what must be TRUE):
  1. An SPL token can be created on devnet with a bonding curve PDA that holds SOL reserves
  2. Tokens can be bought and sold through the curve with correct pricing and slippage protection
  3. Burning tokens for content access returns the correct SOL amount from the curve
  4. Creator vesting account enforces 30-day cliff and 60-day linear vest (cannot claim early)
  5. Platform fees and creator fees are collected into separate vaults on every trade
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md -- Anchor project scaffold, state accounts, errors, and GlobalConfig initialization
- [x] 02-02-PLAN.md -- Bonding curve math module, create_token, buy, and sell instructions
- [x] 02-03-PLAN.md -- burn_for_access, vesting (claim_vested), fee withdrawal, and revoke_vesting instructions
- [x] 02-04-PLAN.md -- Comprehensive test suite (bankrun) and devnet deployment

### Phase 3: Creator Onboarding & Token Launch
**Goal**: Verified creators can set up profiles and launch their own SPL token with anti-rug protections enforced
**Depends on**: Phase 1, Phase 2
**Requirements**: CRTR-01, CRTR-02, CRTR-03, CRTR-04, CRTR-05, SAFE-03, SAFE-04
**Success Criteria** (what must be TRUE):
  1. User can switch to creator role and set up a profile with bio, avatar, and banner
  2. Creator can complete KYC verification through Sumsub before launching a token
  3. Creator can launch an SPL token (name, ticker, image) and see it live on the bonding curve
  4. Creator receives 10% token allocation with vesting schedule visible on their dashboard
  5. Creator cannot launch a new token within 90 days of their last launch (enforced)
  6. Viewers can see KYC verification badge, vesting schedule, and anti-rug protections on creator profiles
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md -- Creator profile DB schema, R2 image upload, profile API, onboarding wizard with profile step and image cropping
- [x] 03-02-PLAN.md -- Sumsub KYC integration (HMAC token generation, webhook handler, embedded WebSDK step)
- [x] 03-03-PLAN.md -- Token launch flow (on-chain create_token transaction, launch API with 90-day cooldown, config/review/success wizard steps)
- [x] 03-04-PLAN.md -- Anti-rug transparency UI (KYC badge, vesting timeline, public creator profile, cooldown display)

### Phase 4: Content Infrastructure
**Goal**: Creators can publish text, image, and video content with automated CSAM scanning before any content goes live
**Depends on**: Phase 1
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-07, CONT-08
**Success Criteria** (what must be TRUE):
  1. Creator can publish a text post visible on their profile
  2. Creator can upload and publish an image post (resized, optimized, delivered via CDN)
  3. Creator can upload and publish a video post (transcoded to standard formats)
  4. All uploaded media is scanned for CSAM before becoming accessible (flagged content is held for review)
  5. Creator can edit and delete their own posts
**Plans**: 5 plans

Plans:
- [x] 04-01-PLAN.md -- Content data model (post, media, moderation, strike tables) and text post CRUD API with draft auto-save
- [x] 04-02-PLAN.md -- Image upload pipeline (R2 presigned URLs, CSAM scanning via Hive, Sharp optimization to responsive WebP)
- [x] 04-03-PLAN.md -- Video upload and Mux transcoding pipeline (R2 first for CSAM scan, then Mux direct upload with webhooks)
- [x] 04-04-PLAN.md -- Post composer UI, media upload components, post feed and creator profile integration
- [x] 04-05-PLAN.md -- Post editing/deletion, admin moderation queue, and 3-strike system

### Phase 5: Token-Gated Content
**Goal**: Viewers holding sufficient creator tokens can access gated content; others see a locked placeholder
**Depends on**: Phase 3, Phase 4
**Requirements**: CONT-04, CONT-05, TOKN-05
**Success Criteria** (what must be TRUE):
  1. Creator can set a post's access level to public, hold-gated, or burn-gated when publishing
  2. Creator can set the token hold threshold required to view gated content
  3. Viewer holding enough tokens sees gated content normally; viewer without enough tokens sees a blurred placeholder with "Hold X tokens to unlock"
  4. Access is verified server-side at content request time (not cached from login)
**Plans**: 3 plans

Plans:
- [ ] 05-01-PLAN.md -- Schema extension (access level, threshold, token balance cache), publish API with access level params, access level step in post composer
- [ ] 05-02-PLAN.md -- Token balance verification via Helius RPC with DB cache, blur variant generation (image + video), R2 presigned GET URLs, Mux signed playback tokens
- [ ] 05-03-PLAN.md -- Gated content media API, locked post rendering with blur overlays, unlock dialog with balance info and placeholder buy/burn buttons

### Phase 6: Token Trading
**Goal**: Viewers can buy and sell creator tokens through the bonding curve with a full trading interface
**Depends on**: Phase 3
**Requirements**: TOKN-01, TOKN-02, TOKN-03, TOKN-04, TOKN-07, TOKN-08
**Success Criteria** (what must be TRUE):
  1. Viewer can buy creator tokens with SOL and see them in their wallet balance
  2. Viewer can sell creator tokens back to the bonding curve and receive SOL
  3. Transaction shows clear fee breakdown (platform fee, creator fee, net amount) before confirmation
  4. Viewer can see a token price chart and bonding curve visualization on the creator page
  5. Platform fee is collected on every buy/sell transaction into the platform vault
  6. Creator fee is collected on every buy/sell transaction into the creator vault
**Plans**: TBD

Plans:
- [ ] 06-01: Buy/sell Server Actions with transaction signing and Helius submission
- [ ] 06-02: Trading UI (amount input, fee breakdown, slippage settings, confirmation flow)
- [ ] 06-03: Helius webhook integration for transaction confirmation and off-chain ledger sync
- [ ] 06-04: Token price chart and bonding curve visualization
- [ ] 06-05: Transaction history with human-readable descriptions

### Phase 7: Burn-to-Unlock Premium Content
**Goal**: Viewers can burn tokens to permanently unlock premium/PPV content, with SOL returned from the curve
**Depends on**: Phase 5, Phase 6
**Requirements**: CONT-06, TOKN-06
**Success Criteria** (what must be TRUE):
  1. Creator can set a burn cost (in tokens) for premium/PPV posts
  2. Viewer sees burn cost and estimated SOL return before confirming a burn-to-unlock
  3. After burning tokens, the premium content is permanently unlocked for that viewer
  4. SOL is returned from the bonding curve to the viewer's wallet proportional to tokens burned
**Plans**: TBD

Plans:
- [ ] 07-01: Burn-gated post creation with burn cost setting
- [ ] 07-02: Burn-to-unlock flow (burn_for_access transaction, confirmation, permanent access grant)
- [ ] 07-03: Burn UI with SOL return estimate and unlock confirmation

### Phase 8: Creator Monetization & Donations
**Goal**: Creators can view all revenue streams, claim vested tokens, withdraw earnings, and receive tips from viewers
**Depends on**: Phase 6, Phase 7
**Requirements**: CRTR-06, CRTR-07, CRTR-08, DONA-01, DONA-02
**Success Criteria** (what must be TRUE):
  1. Creator can view an earnings dashboard showing revenue from burns, trade fees, and tips
  2. Creator can claim vested tokens according to their vesting schedule
  3. Creator can withdraw accumulated trade fee earnings (SOL) to their wallet
  4. Viewer can tip a creator in SOL
  5. Viewer can tip a creator in their token
**Plans**: TBD

Plans:
- [ ] 08-01: Creator earnings dashboard (aggregated from on-chain data via webhooks)
- [ ] 08-02: Vested token claiming flow (claim_vested instruction integration)
- [ ] 08-03: Trade fee withdrawal (withdraw_fees instruction integration)
- [ ] 08-04: Donation system (SOL tips and token tips via donate instructions)

### Phase 9: Discovery & Notifications
**Goal**: Users can find creators through browsing, search, and rankings, and stay informed about activity on tokens they hold
**Depends on**: Phase 6
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05
**Success Criteria** (what must be TRUE):
  1. User can browse creators on a homepage feed
  2. User can search for creators by name or category and get relevant results
  3. User can view a token leaderboard ranked by market cap and trading volume
  4. User receives in-app notifications when creators they hold tokens for publish new content
  5. User receives notifications for token activity (trades and burns on tokens they hold)
**Plans**: TBD

Plans:
- [ ] 09-01: Creator browse feed and homepage layout
- [ ] 09-02: Creator search (name, category) with Postgres full-text search
- [ ] 09-03: Token leaderboard (market cap, volume, trending rankings)
- [ ] 09-04: Notification system (in-app notifications for content and token activity)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9
(Phases 1 and 2 can run in parallel as they have no mutual dependencies)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Authentication & Wallets | 3/3 | Complete | 2026-02-01 |
| 2. Bonding Curve Smart Contract | 4/4 | Complete | 2026-02-01 |
| 3. Creator Onboarding & Token Launch | 4/4 | Complete | 2026-02-01 |
| 4. Content Infrastructure | 5/5 | Complete | 2026-02-01 |
| 5. Token-Gated Content | 0/3 | Planned | - |
| 6. Token Trading | 0/5 | Not started | - |
| 7. Burn-to-Unlock Premium Content | 0/3 | Not started | - |
| 8. Creator Monetization & Donations | 0/4 | Not started | - |
| 9. Discovery & Notifications | 0/4 | Not started | - |
