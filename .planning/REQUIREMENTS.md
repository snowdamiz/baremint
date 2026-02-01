# Requirements: Baremint

**Defined:** 2026-01-31
**Core Value:** Creators can monetize content through their own token economy without viewers needing to understand crypto

## v1 Requirements

### Authentication & Wallets

- [x] **AUTH-01**: User can create account with email and password
- [x] **AUTH-02**: User can sign up/log in via Google or Twitter OAuth
- [x] **AUTH-03**: User can enable TOTP-based two-factor authentication
- [x] **AUTH-04**: Custodial Solana wallet created automatically on signup
- [x] **AUTH-05**: Wallet private keys encrypted with AES-256-GCM and stored in database
- [x] **AUTH-06**: User can view their SOL balance and token holdings
- [x] **AUTH-07**: User can withdraw SOL to an external Solana wallet address

### Creator Profiles & KYC

- [x] **CRTR-01**: User can switch to creator role and set up a profile (bio, avatar, banner)
- [x] **CRTR-02**: Creator can complete KYC verification via Sumsub before launching a token
- [x] **CRTR-03**: Creator can launch their own SPL token on a permanent bonding curve
- [x] **CRTR-04**: Creator receives 10% token allocation with 30-day cliff + 60-day linear vest
- [x] **CRTR-05**: Creator cannot launch a new token for 90 days after their last launch
- [ ] **CRTR-06**: Creator can view earnings dashboard (burns, trade fees, tips, total revenue)
- [ ] **CRTR-07**: Creator can claim vested tokens according to schedule
- [ ] **CRTR-08**: Creator can withdraw accumulated trade fee earnings (SOL)

### Content

- [x] **CONT-01**: Creator can publish text posts
- [x] **CONT-02**: Creator can upload and publish image posts
- [x] **CONT-03**: Creator can upload and publish video posts
- [ ] **CONT-04**: Creator can set content access level (public, hold-gated, burn-gated/PPV)
- [ ] **CONT-05**: Creator can set token hold threshold for gated content
- [ ] **CONT-06**: Creator can set burn cost for premium/PPV content
- [x] **CONT-07**: All uploaded content is automatically scanned for CSAM before going live
- [x] **CONT-08**: Creator can edit and delete their own posts

### Token Economy

- [ ] **TOKN-01**: Viewer can buy creator tokens with SOL via bonding curve
- [ ] **TOKN-02**: Viewer can sell creator tokens back to bonding curve for SOL
- [ ] **TOKN-03**: Transaction shows fee breakdown (platform fee, creator fee, net amount)
- [ ] **TOKN-04**: Viewer can view token price chart and bonding curve visualization
- [ ] **TOKN-05**: Holding sufficient tokens unlocks creator's general feed
- [ ] **TOKN-06**: Burning tokens unlocks premium/PPV content and returns SOL from curve
- [ ] **TOKN-07**: Platform collects a fee on every buy/sell transaction
- [ ] **TOKN-08**: Creator earns a fee on every buy/sell of their token

### Donations

- [ ] **DONA-01**: Viewer can tip a creator in SOL
- [ ] **DONA-02**: Viewer can tip a creator in their token

### Discovery

- [ ] **DISC-01**: User can browse creators on a homepage feed
- [ ] **DISC-02**: User can search for creators by name or category
- [ ] **DISC-03**: User can view token leaderboard ranked by market cap/volume
- [ ] **DISC-04**: User receives in-app notifications for new content from held creators
- [ ] **DISC-05**: User receives notifications for token activity (trades, burns on their tokens)

### Anti-Rug Protections

- [x] **SAFE-01**: Creator's 10% allocation is locked with enforced vesting (30d cliff + 60d linear)
- [x] **SAFE-02**: 90-day cooldown between token launches is enforced
- [x] **SAFE-03**: KYC verification status and vesting schedule are visible on creator profiles
- [x] **SAFE-04**: Anti-rug protections are transparent and displayed to viewers before purchasing

## v2 Requirements

### Streaming & Community

- **STRM-01**: Creator can start a live stream accessible to token holders
- **STRM-02**: Creator can set token-holder tiers with multiple access levels
- **COMM-01**: Creator can enable token-gated comments on posts
- **COMM-02**: Creator and viewer can exchange direct messages

### Growth & Analytics

- **GROW-01**: User can refer others and earn fee sharing on referred trades
- **GROW-02**: User can view portfolio across all held creator tokens
- **GROW-03**: User can set token price alerts
- **GROW-04**: Creator can view advanced analytics (holder demographics, burn rate, revenue per post)

### Fiat Integration

- **FIAT-01**: User can deposit via fiat on-ramp (card to SOL)
- **FIAT-02**: Creator can withdraw earnings to bank account via fiat off-ramp

## Out of Scope

| Feature | Reason |
|---------|--------|
| DEX graduation | Permanent bonding curve by design |
| Governance/voting on creator decisions | Creates toxic entitled-fan dynamics |
| Token airdrops/free distribution | Kills token price (friend.tech lesson) |
| DeFi features (staking, yield, LP) | Alienates target audience, adds smart contract risk |
| Content DRM/download prevention | False security, wastes engineering effort |
| Native mobile app | App store review nightmare for crypto+content platform |
| On-chain content storage (IPFS/Arweave) | Expensive, slow, blocks content moderation |
| SMS-based 2FA | SIM-swap risk for custodial wallet platform |
| Automated market making beyond bonding curve | Heavier regulatory burden as financial product |
| Anonymous creator token launches | Every unverified launch is a potential rug pull |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| AUTH-06 | Phase 1 | Complete |
| AUTH-07 | Phase 1 | Complete |
| CRTR-01 | Phase 3 | Complete |
| CRTR-02 | Phase 3 | Complete |
| CRTR-03 | Phase 3 | Complete |
| CRTR-04 | Phase 3 | Complete |
| CRTR-05 | Phase 3 | Complete |
| CRTR-06 | Phase 8 | Pending |
| CRTR-07 | Phase 8 | Pending |
| CRTR-08 | Phase 8 | Pending |
| CONT-01 | Phase 4 | Complete |
| CONT-02 | Phase 4 | Complete |
| CONT-03 | Phase 4 | Complete |
| CONT-04 | Phase 5 | Pending |
| CONT-05 | Phase 5 | Pending |
| CONT-06 | Phase 7 | Pending |
| CONT-07 | Phase 4 | Complete |
| CONT-08 | Phase 4 | Complete |
| TOKN-01 | Phase 6 | Pending |
| TOKN-02 | Phase 6 | Pending |
| TOKN-03 | Phase 6 | Pending |
| TOKN-04 | Phase 6 | Pending |
| TOKN-05 | Phase 5 | Pending |
| TOKN-06 | Phase 7 | Pending |
| TOKN-07 | Phase 6 | Pending |
| TOKN-08 | Phase 6 | Pending |
| DONA-01 | Phase 8 | Pending |
| DONA-02 | Phase 8 | Pending |
| DISC-01 | Phase 9 | Pending |
| DISC-02 | Phase 9 | Pending |
| DISC-03 | Phase 9 | Pending |
| DISC-04 | Phase 9 | Pending |
| DISC-05 | Phase 9 | Pending |
| SAFE-01 | Phase 2 | Complete |
| SAFE-02 | Phase 2 | Complete |
| SAFE-03 | Phase 3 | Complete |
| SAFE-04 | Phase 3 | Complete |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0

---
*Requirements defined: 2026-01-31*
*Last updated: 2026-02-01 after Phase 4 completion*
