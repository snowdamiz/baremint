# Baremint

## What This Is

A crypto-native creator platform where each creator launches their own SPL token on a permanent bonding curve. Viewers buy tokens to access content (hold for the general feed, burn for premium/PPV), and creators earn from deflationary token burns plus a fee on every trade. Custodial wallets abstract away crypto complexity — users sign up with email or social login and get a Solana wallet behind the scenes. Includes full content pipeline (text, image, video with CSAM scanning), token trading with price charts, earnings dashboard, and creator discovery.

## Core Value

Creators can monetize content through their own token economy without viewers needing to understand crypto — buy, hold, burn, tip, all behind a clean UI.

## Requirements

### Validated

- ✓ Next.js 16 App Router with TypeScript — existing
- ✓ Tailwind CSS v4 styling — existing
- ✓ React 19 with Server Components — existing
- ✓ User authentication (email/password + Google/Twitter OAuth + TOTP 2FA) — v1.0
- ✓ Custodial wallet system (wallet created on signup, AES-256-GCM encrypted keys) — v1.0
- ✓ Creator profiles with KYC verification and token launch — v1.0
- ✓ Bonding curve token system (permanent curve, buy/sell/burn) — v1.0
- ✓ 10% creator token allocation with 30-day cliff + 60-day linear vest — v1.0
- ✓ Content posting (text, images, videos with CSAM scanning) — v1.0
- ✓ Token-gated content access (hold threshold for general feed) — v1.0
- ✓ Burn-to-unlock premium/PPV content (deflationary burn) — v1.0
- ✓ Creator revenue from trade fees (% cut on every buy/sell) — v1.0
- ✓ Platform fee on trades — v1.0
- ✓ Donations (SOL tips and token tips) — v1.0
- ✓ Withdrawals to external Solana wallet — v1.0
- ✓ Creator discovery (browse feed, full-text search, token leaderboard) — v1.0
- ✓ KYC verification required before token launch (Sumsub) — v1.0
- ✓ 90-day cooldown between creator token launches — v1.0
- ✓ Anti-rug protections (vesting, KYC gate, cooldown, transparency UI) — v1.0
- ✓ Cloud storage for media uploads (Cloudflare R2) — v1.0
- ✓ In-app notifications for content and token activity — v1.0

### Active

(None — next milestone requirements TBD via `/gsd:new-milestone`)

### Out of Scope

- Live streaming — deferred to v2, high complexity
- Fiat offramp/bank withdrawals — v1 is crypto-native, external wallet only
- DEX graduation — bonding curve stays permanent by design
- Mobile app — web-first, PWA potential
- Real-time chat/messaging — not core to v1 content monetization
- Offline mode — real-time token verification is core
- SMS-based 2FA — SIM-swap risk for custodial wallet platform

## Context

Shipped v1.0 with 25,735 LOC (24,219 TypeScript + 1,516 Rust).
Tech stack: Next.js 16, Better Auth, Drizzle ORM, PostgreSQL, Solana (Anchor), Helius RPC, Cloudflare R2, Mux (video), Sumsub (KYC), shadcn/ui, Tailwind CSS v4.
42 requirements across 7 domains all satisfied.
Audit passed with minor tech debt (no blocking issues).

Known tech debt:
- Trade page doesn't fetch actual wallet balance from RPC (quick-amount buttons non-functional)
- Notification fan-out capped at 1000 holders (MVP limitation)
- Polling-based notifications (30s) — WebSocket/SSE would improve UX
- No rate limiting on API endpoints — needed before production
- 1 minor test failure in vesting idempotent revoke test
- Devnet deployment pending SOL faucet availability

## Constraints

- **Tech Stack**: Next.js, Tailwind CSS, shadcn/ui, Solana, Helius RPC, Metaplex — user-specified, non-negotiable
- **Wallet Model**: Custodial with AES-256 encrypted keys in database — simplifies UX but requires strong security practices
- **Token Model**: Permanent bonding curve, no DEX graduation — by design
- **KYC**: Required for creators before token launch — regulatory and anti-rug requirement
- **Cooldown**: 90 days minimum between token launches per creator
- **Vesting**: 10% creator allocation, 30-day cliff + 60-day linear vest

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Permanent bonding curve (no graduation) | Simpler model, prevents liquidity fragmentation | ✓ Good — implemented and tested |
| Custodial wallets with encrypted keys in DB | Lower barrier to entry for non-crypto users | ✓ Good — AES-256-GCM with Node.js crypto |
| KYC gate for token launch | Anti-rug protection, regulatory compliance | ✓ Good — Sumsub integration with webhook verification |
| 30-day cliff + 60-day linear vest | Prevents early dumps while token gains traction | ✓ Good — weekly snapping leaves ~6.7% locked (acceptable) |
| Cloud storage over IPFS | Simpler, more cost-effective, better UX for video | ✓ Good — R2 presigned URLs + Mux transcoding |
| Live streaming deferred to v2 | Reduce v1 scope, ship core monetization first | ✓ Good — shipped core in 2 days |
| Platform fee on trades only | Clean revenue model, no friction on withdrawals | ✓ Good — fee split works on-chain |
| Deflationary burn (no SOL return to viewer) | Simpler economics, tokens permanently destroyed | ✓ Good — fees extracted from reserves |
| Soft-delete posts for legal compliance | Never hard delete user content | ✓ Good — status=removed pattern |
| ADMIN_EMAILS env var for admin check | No roles table needed for MVP | ⚠️ Revisit — proper admin roles for v2 |
| Polling for notifications (30s) | Simpler than WebSocket/SSE for MVP | ⚠️ Revisit — upgrade to real-time for scale |
| Fan-out cap at 1000 holders | Prevent unbounded notification inserts | ⚠️ Revisit — queue-based fan-out for popular creators |

---
*Last updated: 2026-02-01 after v1.0 milestone*
