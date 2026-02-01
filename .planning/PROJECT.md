# Baremint

## What This Is

A crypto-native creator platform where each creator launches their own SPL token on a permanent bonding curve. Viewers buy tokens to access content (hold for the general feed, burn for premium/PPV), and creators earn from token burns returning SOL from the curve plus a fee on every trade. Custodial wallets abstract away crypto complexity — users sign up with email or social login and get a Solana wallet behind the scenes.

## Core Value

Creators can monetize content through their own token economy without viewers needing to understand crypto — buy, hold, burn, tip, all behind a clean UI.

## Requirements

### Validated

- ✓ Next.js 16 App Router with TypeScript — existing
- ✓ Tailwind CSS v4 styling — existing
- ✓ React 19 with Server Components — existing

### Active

- [ ] User authentication (email/password + social login)
- [ ] Custodial wallet system (wallet created on signup, private keys AES-256 encrypted in DB)
- [ ] Creator profiles with manual token launch
- [ ] Bonding curve token system (permanent curve, no DEX graduation)
- [ ] 10% creator token allocation with 30-day cliff + 60-day linear vest
- [ ] Content posting (images, videos, text)
- [ ] Token-gated content access (hold threshold for general feed)
- [ ] Burn-to-unlock premium/PPV content
- [ ] Creator revenue from token burns (SOL returned from curve)
- [ ] Creator revenue from trade fees (% cut on every buy/sell)
- [ ] Platform fee on trades
- [ ] Donations (SOL tips and token tips)
- [ ] Withdrawals to external Solana wallet
- [ ] Creator discovery (browse/search + token leaderboard/rankings)
- [ ] KYC verification required before token launch
- [ ] 90-day cooldown between creator token launches
- [ ] Anti-rug protections (vesting schedule, KYC gate, cooldown)
- [ ] Cloud storage for media uploads (S3/R2)

### Out of Scope

- Live streaming — deferred to v2, high complexity
- Fiat offramp/bank withdrawals — v1 is crypto-native, external wallet only
- DEX graduation — bonding curve stays permanent by design
- Mobile app — web-first
- Real-time chat/messaging — not core to v1 content monetization

## Context

- Existing codebase is a fresh Next.js 16 scaffold with Tailwind CSS v4, no business logic yet
- Token model inspired by pump.fun bonding curves but without graduation
- Monetization is dual: creators earn from burns (SOL flows back from curve) AND from trade fees
- Custodial wallet approach chosen to lower barrier to entry — users don't need Phantom or any external wallet
- KYC + vesting + cooldowns form the anti-rug protection layer
- Solana chosen for low transaction costs and fast finality
- Helius RPC for reliable Solana infrastructure
- Metaplex for SPL token creation and management

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
| Permanent bonding curve (no graduation) | Simpler model, prevents liquidity fragmentation | — Pending |
| Custodial wallets with encrypted keys in DB | Lower barrier to entry for non-crypto users | — Pending |
| KYC gate for token launch | Anti-rug protection, regulatory compliance | — Pending |
| 30-day cliff + 60-day linear vest | Prevents early dumps while token gains traction | — Pending |
| Cloud storage over IPFS | Simpler, more cost-effective, better UX for video | — Pending |
| Live streaming deferred to v2 | Reduce v1 scope, ship core monetization first | — Pending |
| Platform fee on trades only | Clean revenue model, no friction on withdrawals | — Pending |

---
*Last updated: 2026-01-31 after initialization*
