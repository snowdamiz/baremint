# Feature Landscape

**Domain:** Crypto-native creator platform (OnlyFans meets pump.fun)
**Researched:** 2026-01-31
**Overall confidence:** MEDIUM-HIGH

---

## Table Stakes

Features users expect from day one. Missing any of these and the platform feels broken or untrustworthy.

### Creator Platform Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Creator profiles | Every creator platform has them. Without profiles, there is no identity. | Low | Bio, avatar, banner, social links, token stats |
| Content feed (images, video, text) | Core product. OnlyFans/Patreon/Fansly all center on content feeds. | Medium | Need upload pipeline, transcoding for video, CDN delivery |
| Content access gating | The entire monetization model depends on this. Users expect clear "locked/unlocked" states. | Medium | Hold-threshold gating for general feed is the baseline |
| Pay-per-view / premium content | 20-40% of successful OnlyFans creators' income comes from PPV. Users expect it. | Medium | Burn-to-unlock model is Baremint's PPV equivalent |
| Creator discovery / search | Users need to find creators. Every platform has browse + search. | Medium | Search by name, category/tags, trending |
| Token leaderboard / rankings | In any token platform, a leaderboard is how people find momentum. Pump.fun's entire UX is a leaderboard. | Low-Medium | Market cap ranking, volume, trending, new launches |
| Creator earnings dashboard | Creators will not use a platform where they cannot see what they are earning. | Medium | Burns, trade fees, tips, total revenue, token price chart |
| User authentication | Email/password + social login is baseline for any consumer app. | Medium | OAuth providers + email/password. Custodial wallet created on signup. |
| KYC for creators | Regulatory requirement and anti-rug protection. OnlyFans requires ID verification for all creators. | Medium | Third-party provider (Veriff, Persona, Jumio). Must verify before token launch. |
| Notifications | Users need to know when creators post, when tokens move, when content unlocks. | Medium | Push notifications, in-app notifications, email digests |
| Mobile-responsive web | Not a native app (out of scope), but the web app MUST work well on mobile. Most OnlyFans traffic is mobile. | Medium | Responsive design is non-negotiable for a consumer content platform |
| Content moderation / CSAM detection | Legal requirement in US, UK (Online Safety Act), EU (DSA). Missing this is an existential legal risk. | High | PhotoDNA or equivalent hash-matching for images. Automated first pass + human review. NCMEC reporting pipeline. |
| Age verification for viewers | Regulatory trend accelerating in 2025-2026. UK OSA, various US state laws. | Medium | Age gate at minimum. May need document verification depending on jurisdiction and content type. |
| Wallet balance display | Users need to see their SOL balance, token holdings, and portfolio value. | Low | Dashboard showing balances, recent transactions |
| Withdrawal to external wallet | Users will not trust a platform where funds cannot leave. | Medium | SOL withdrawal to any Solana address. Must work reliably. |

### Token/Crypto Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Token launch flow | Core mechanic. Must be dead simple for creators. Pump.fun proved one-click launch is the bar. | High | Name, ticker, image, description -> deploy SPL token + bonding curve |
| Bonding curve with transparent pricing | Users expect to see how price changes with supply. Pump.fun made this standard. | High | Price chart showing curve, current price, market cap, supply |
| Buy/sell tokens | Core transaction. Must be fast and reliable. | High | Interact with bonding curve smart contract. Show slippage, fees, estimated output. |
| Transaction history | Users expect to see their trades and burns. | Low-Medium | On-chain transaction log with human-readable descriptions |
| Anti-rug protections (visible) | After friend.tech and Rally collapses, users are wary. Must visibly show vesting schedule, creator allocation, cooldowns. | Medium | Display vesting status on creator profile. Show locked vs unlocked allocation. |
| Platform fee transparency | Users hate hidden fees. Show exactly what the platform takes on each trade. | Low | Fee breakdown on every transaction confirmation |

---

## Differentiators

Features that set Baremint apart. Not expected by default, but create competitive advantage.

### High-Value Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Burn-to-unlock content model | Novel mechanic not seen in other platforms. Creates deflationary pressure on token supply, driving price for holders. Aligns incentives: viewers who burn get premium content, remaining holders see price appreciation. | High | This IS the core differentiator. No one else does hold-for-feed + burn-for-PPV. |
| Permanent bonding curve (no graduation) | Unlike pump.fun where tokens graduate to DEX and liquidity fragments, Baremint curves are permanent. Simpler mental model, predictable pricing, no "graduation dump." | High | Technically simpler than graduation model but requires its own smart contract design |
| Custodial wallet abstraction | Crypto-native economics with Web2 UX. Users never see seed phrases, gas fees are abstracted. Dramatically lowers barrier vs. friend.tech (which required MetaMask). | High | Key management is the hardest part. AES-256 encryption, HSM consideration for production. Security is existential. |
| Creator token economy (not just tips) | Unlike Patreon (subscriptions) or OnlyFans (subscriptions + tips), creators have their own token economy with price discovery. Early supporters benefit from price appreciation. | High | The dual revenue model (burns + trade fees) is unique and compelling for creators |
| Anti-rug protection layer | KYC + vesting + cooldown as a system. Most token platforms have NONE of these. This is a trust differentiator. | Medium | 10% allocation, 30-day cliff, 60-day vest, 90-day cooldown. All enforced on-chain or in smart contracts. |

### Medium-Value Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Token-holder tiers | Multiple access levels based on token holdings (e.g., hold 100 for feed, hold 500 for DMs, burn 50 for premium post). Richer than binary gating. | Medium | Phase 2 enhancement. Start with simple hold/burn gates, add tiers later. |
| Creator analytics (token metrics) | Show creators their token velocity, holder count, burn rate, revenue per post. No other creator platform gives this level of financial analytics. | Medium | Unique data that creators cannot get anywhere else |
| Social proof / holder badges | Show how long someone has held tokens, their tier, their burn history. Creates community status. | Low-Medium | Badge system based on on-chain data |
| Token price alerts | Notify users when a creator's token hits a price target. Pump.fun added this in 2025 — users expect it from token platforms. | Low-Medium | Price monitoring + notification system |
| Referral system | Creator referrals and viewer referrals with fee sharing. Pump.fun's growth was viral; need organic growth loops. | Medium | Fee split on referred trades. Track referral chains. |

### Lower-Value Differentiators (Nice to Have)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Token-gated comments / community | Only token holders can comment on posts. Creates quality community. | Low-Medium | Defer to post-MVP |
| Creator collaboration tokens | Two creators launch a joint token. Novel but niche. | High | Far future. Complex tokenomics. |
| Portfolio view | Show users their total holdings across all creators, P&L, portfolio performance. | Medium | Aggregation of on-chain data |
| Scheduled content drops | Creators schedule posts tied to token milestones (e.g., "unlocks when market cap hits X"). | Medium | Interesting mechanic but not core |

---

## Anti-Features

Features to deliberately NOT build. Common mistakes in this domain that Baremint should avoid.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| DEX graduation / liquidity migration | Pump.fun's graduation model causes dump-at-graduation events, fragments liquidity, confuses users. Baremint's permanent curve is a deliberate design choice. | Keep curves permanent. Price is always deterministic from supply. |
| Governance / voting on creator decisions | Chiliz/Socios does this for sports teams, but for individual creators it creates entitled fans who feel they "own" the creator. Toxic dynamic. | Tokens are for access and speculation, NOT governance. Creators retain full creative control. |
| Airdrop / free token distribution | Friend.tech's airdrop killed the token price (98% crash). Free tokens attract dumpers, not community. | Tokens are only acquired through bonding curve purchases. No airdrops, no farming. |
| Complex DeFi features (staking, yield, LP) | Adding DeFi complexity alienates the target audience (content consumers, not DeFi degens). Adds massive smart contract risk. | Keep it simple: buy, hold, burn, tip, sell. No staking pools, no yield farming. |
| Real-time chat / DMs (v1) | OnlyFans DMs are a massive moderation burden and a vector for exploitation. Resource-intensive to build and moderate. | Defer to v2. Focus on content feed as primary interaction. |
| Fiat on/off ramp (v1) | Adds massive regulatory burden (money transmitter licenses, banking relationships). | V1 is crypto-native. Users bring SOL, withdraw SOL. Add fiat later with a partner. |
| Anonymous creator launches | Without KYC, every token launch is a potential rug pull. Friend.tech and pump.fun are full of scams because anyone can launch. | KYC required. This is a feature, not a limitation. Market it as "verified creators only." |
| Unlimited token launches per creator | Multiple simultaneous tokens per creator fragments their community and enables pump-and-dump patterns. | 90-day cooldown enforced. One active token per creator at a time. |
| Content DRM / download prevention | False sense of security. Screenshots and screen recording always work. Wastes engineering effort and annoys legitimate users. | Accept that content will leak. Focus on the TOKEN value (access + appreciation) as the real product, not the content files themselves. |
| Native mobile app (v1) | App store review for crypto + content platform is a nightmare (Apple takes 30%, bans crypto trading in many cases). | PWA-ready responsive web app. Consider native app only after proven product-market fit. |
| On-chain content storage (IPFS/Arweave) | Expensive, slow, and makes content moderation nearly impossible. Cannot remove illegal content from decentralized storage. | Use cloud storage (S3/R2). Centralized content storage is a FEATURE for moderation and compliance. |
| Automated market making beyond bonding curve | Adding AMM pools, order books, or DEX features makes this a financial product with much heavier regulatory burden. | Single bonding curve per token. No secondary markets on-platform. Users can withdraw tokens and trade elsewhere if they want. |

---

## Feature Dependencies

```
Authentication
  |-> Custodial Wallet Creation
  |     |-> SOL Deposits
  |     |     |-> Token Purchases (buy on bonding curve)
  |     |     |     |-> Content Access (hold-gated)
  |     |     |     |-> Token Burns -> Premium Content Unlock
  |     |     |     |-> Token Sales (sell on bonding curve)
  |     |     |-> SOL Tips / Donations
  |     |-> Withdrawals to External Wallet
  |
  |-> Creator Profile
  |     |-> KYC Verification
  |     |     |-> Token Launch
  |     |     |     |-> Bonding Curve Deployment
  |     |     |     |-> Creator Allocation + Vesting Schedule
  |     |     |     |-> Token Listed in Discovery / Leaderboard
  |     |-> Content Upload Pipeline
  |           |-> Image Upload + Processing
  |           |-> Video Upload + Transcoding
  |           |-> Post Creation (with gating rules: free / hold-gated / burn-gated)
  |
  |-> Content Moderation Pipeline (parallel, required before content goes live)
        |-> Automated Scan (PhotoDNA / hash matching)
        |-> Manual Review Queue (flagged content)
        |-> NCMEC Reporting Pipeline
```

### Critical Path Dependencies

1. **Auth + Wallet** must exist before anything else works
2. **Token launch** requires KYC to be complete
3. **Content gating** requires both content pipeline AND token system to be functional
4. **Burn-to-unlock** requires the bonding curve to handle burn mechanics correctly (SOL return calculation)
5. **Content moderation** must be operational before ANY user-generated content goes live
6. **Discovery / leaderboard** requires at least a few creators with tokens to be useful

---

## MVP Recommendation

### Must Ship in MVP (Phase 1-2)

1. **Auth + custodial wallet** -- without this, nothing works
2. **Creator profiles + KYC flow** -- creators need to exist and be verified
3. **Token launch + bonding curve** -- the core economic primitive
4. **Content upload (images + text first, video second)** -- the core product
5. **Hold-gated content access** -- simplest gating mechanism, proves the model
6. **Buy/sell tokens on bonding curve** -- core transaction
7. **Content moderation pipeline** -- legal requirement, cannot launch without it
8. **Creator earnings dashboard** -- creators need to see revenue
9. **Basic discovery (browse + search)** -- users need to find creators

### Ship in Fast-Follow (Phase 3)

10. **Burn-to-unlock premium/PPV** -- the key differentiator, but hold-gating alone proves the model first
11. **Video upload + transcoding** -- higher complexity, defer if images + text prove the model
12. **Token leaderboard / rankings** -- enhances discovery but not blocking
13. **Notifications** -- important for retention but not for initial validation
14. **SOL tips / donations** -- additional revenue stream for creators

### Defer to Post-MVP (Phase 4+)

- Token-holder tiers (multiple access levels)
- Social proof / holder badges
- Token price alerts
- Referral system
- Portfolio view
- Scheduled content drops
- Token-gated comments

---

## Competitive Feature Matrix

| Feature | OnlyFans | Patreon | Fansly | Pump.fun | Friend.tech | **Baremint** |
|---------|----------|---------|--------|----------|-------------|-------------|
| Subscription model | Yes | Yes | Yes | No | No | **Token-hold (novel)** |
| PPV / premium content | Yes ($3-200) | Limited | Yes | No | No | **Burn-to-unlock (novel)** |
| Tips / donations | Yes (max $100) | Yes | Yes | No | No | **SOL + token tips** |
| Creator tokens | No | No | No | Yes (memecoins) | Yes (keys) | **Yes (SPL on bonding curve)** |
| Token price discovery | N/A | N/A | N/A | Bonding curve -> DEX | Bonding curve | **Permanent bonding curve** |
| Anti-rug protections | N/A | N/A | N/A | None | None | **KYC + vesting + cooldown** |
| Content types | Images, video, text, DMs, streams | All media + community | Same as OF + tiers | N/A | Chat only | **Images, video, text** |
| Crypto complexity for user | N/A | N/A | N/A | High (need wallet) | High (need wallet) | **Low (custodial wallet)** |
| Creator verification | ID required | ID required | ID + ISO 27001 | None | None | **KYC required** |
| Platform fee | 20% | 5-12% | 20% | 1% swap + 1.5 SOL grad | 5% + 5% | **% on trades (TBD)** |
| Content moderation | Yes | Yes | Yes (strongest) | N/A | Minimal | **Required (automated + human)** |
| Livestreaming | Yes | Yes | Yes | Yes (added 2025) | No | **Deferred to v2** |
| DMs / messaging | Yes (key revenue) | Limited | Yes | No | Token-gated chat | **Deferred to v2** |
| Fiat payments | Yes | Yes | Yes | No | No | **No (crypto-native v1)** |
| Mobile app | iOS + Android | iOS + Android | iOS + Android | iOS + Android | PWA | **Responsive web** |

---

## Key Insight: The "Two Audience" Challenge

Baremint serves two distinct audiences with different expectations:

**Content consumers** (coming from OnlyFans/Patreon world):
- Expect: easy signup, content feed, payment simplicity, mobile-friendly
- Do NOT expect: token charts, bonding curves, wallet management
- Risk: crypto complexity drives them away

**Crypto/token traders** (coming from pump.fun world):
- Expect: price charts, trading UI, leaderboards, real-time data
- Do NOT expect: content moderation, KYC, creator verification
- Risk: compliance requirements feel restrictive

**The UX challenge is serving both without alienating either.** The custodial wallet + clean UI strategy is the right approach, but it means building essentially two interaction layers: a "content consumer" view (feed, unlock, enjoy) and a "token holder" view (chart, trade, portfolio).

---

## Sources

### Traditional Creator Platforms
- [OnlyFans Pricing Guide 2025](https://onlysonar.com/blog/onlyfans-pricing-guide)
- [OnlyFans 2025 Features and Monetization](https://www.thebluetalent.com/blog/the-future-of-onlyfans-2025-upcoming-features-and-monetization-tactics)
- [Top Platforms Comparison](https://vop360.com/best-platforms-adult-content-creators/)
- [Fansly vs OnlyFans vs Patreon](https://moneycheck.com/fansly-vs-onlyfans-vs-patreon/)

### Crypto Token Platforms
- [Pump.fun Overview](https://beincrypto.com/learn/what-is-pump-fun/)
- [Creator Capital Markets: Pump.fun in 2025](https://finance.yahoo.com/news/creator-capital-markets-pump-fun-190102362.html)
- [Friend.tech Shutdown](https://finance.yahoo.com/news/social-platform-friend-tech-shuts-065105515.html)
- [Rally Shutdown](https://decrypt.co/120285/social-token-platform-rally-shutting-down)
- [SocialFi Lessons Learned](https://cointelegraph.com/news/friendtech-failure-socialfi-success-adoption)
- [Bitget SocialFi Analysis](https://www.bitget.com/news/detail/12560604275814)

### Token Gating & Access Control
- [Shopify Token Gating Guide](https://www.shopify.com/blog/token-gating)
- [Token Gating Complete Guide](https://nftnewstoday.com/2025/02/13/what-is-token-gating-your-complete-guide-to-exclusive-web3-access)

### Anti-Rug & Tokenomics
- [Token Vesting Guide](https://www.bitbond.com/resources/token-vesting-comprehensive-guide-for-crypto-projects/)
- [Binance Rug Pull Guide](https://academy.binance.com/en/articles/what-is-a-rug-pull-in-crypto-and-how-does-it-work)

### Compliance & Safety
- [Global Content Regulation 2025](https://www.kslaw.com/news-and-insights/the-global-content-regulation-landscape-developments-in-the-eu-uk-us-and-beyond)
- [Passes Trust & Safety Approach](https://blog.passes.com/announcements/building-a-safe-passage-the-passes-trust-safety-approach/)
- [Age Verification for Creator Platforms](https://fanso.io/blog/age-verification-for-creator-platforms-tools-compliance-best-practices/)

### Fan Token Platforms
- [Chiliz/Socios 2025 Overview](https://www.chiliz.com/the-chiliz-chain-in-2025-from-fan-tokens-to-a-sovereign-stadium/)
- [Socios Fan Tokens](https://www.socios.com/fan-tokens/)
