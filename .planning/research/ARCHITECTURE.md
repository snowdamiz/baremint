# Architecture Patterns

**Domain:** Crypto-native creator platform (Solana bonding curves, custodial wallets, token-gated content)
**Researched:** 2026-01-31

## System Overview

Baremint is a three-tier system: a Next.js 16 web application (frontend + backend), an Anchor-based Solana program (on-chain logic), and external services (Helius RPC, cloud storage, KYC provider). The critical architectural boundary is between **on-chain state** (token supply, bonding curve reserves, SOL balances) and **off-chain state** (user profiles, content metadata, encrypted wallet keys, KYC records).

```
+------------------------------------------------------------------+
|                        CLIENT (Browser)                          |
|  Next.js App Router (RSC + Client Components)                   |
|  - UI rendering, navigation, real-time price display             |
|  - NO private keys, NO direct RPC calls for transactions         |
+------------------------------------------------------------------+
           |                    |                    |
     Server Actions        API Routes          WebSocket/SSE
           |                    |                    |
+------------------------------------------------------------------+
|                     NEXT.JS SERVER LAYER                         |
|  Server Actions: mutations (buy, sell, tip, withdraw, post)      |
|  API Routes: webhooks (Helius, KYC provider), cron jobs          |
|  Middleware: auth check, rate limiting                            |
+------------------------------------------------------------------+
     |              |              |              |
  Database     Key Vault     Cloud Storage    Helius RPC
     |              |              |              |
+----------+  +-----------+  +----------+  +------------+
| Postgres |  | Encrypted |  | R2 / S3  |  | Solana     |
| (Neon/   |  | Keys in   |  | (media)  |  | Mainnet    |
| Supabase)|  | DB + KMS  |  +----------+  | via Helius |
+----------+  +-----------+                +------------+
                                                 |
                                      +---------------------+
                                      | SOLANA PROGRAM       |
                                      | (Anchor / Rust)      |
                                      | - Bonding curve PDAs |
                                      | - Buy/Sell/Burn      |
                                      | - Fee distribution   |
                                      | - Vesting schedule   |
                                      +---------------------+
```

## Component Boundaries

### 1. Frontend Layer (Next.js App Router)

| Responsibility | Details |
|---|---|
| UI rendering | Server Components for static content, Client Components for interactive elements (trading UI, real-time prices) |
| Navigation | App Router file-based routing, route groups for auth/creator/viewer flows |
| Form submission | Server Actions for all mutations (no raw fetch calls) |
| State management | React 19 `use()` + Server Components for data; minimal client state for UI-only concerns |
| Token gating UI | Renders gated/ungated states based on server-checked access levels |

**Does NOT handle:** Private key operations, direct Solana RPC calls for transactions, media processing.

### 2. Server Layer (Next.js Server Actions + API Routes)

This is the most critical layer. It acts as a **Backend-for-Frontend (BFF)** that:

| Responsibility | Implementation |
|---|---|
| Authentication | NextAuth.js / Auth.js with email/password + social providers. Session-based, not wallet-based (custodial model). |
| Transaction construction + signing | Server Actions decrypt user wallet keys, build Solana transactions, sign them server-side, submit via Helius RPC. Users never see or touch keys. |
| Content access control | Server checks token balance (via Helius DAS API) before serving content URLs. Signed/expiring URLs for media. |
| Content upload | Accepts uploads, processes (resize/transcode if needed), stores in R2/S3, saves metadata in DB. |
| Webhook ingestion | API routes receive Helius webhooks for on-chain events (trades, burns) to update off-chain state. |
| KYC orchestration | Proxies KYC provider flow, stores verification status in DB. |
| Fee accounting | Tracks platform fees, creator earnings, withdrawal eligibility. |

**Security boundary:** This layer is the ONLY place where decrypted private keys exist in memory, and only for the duration of a transaction signing operation.

### 3. Database Layer (PostgreSQL)

Core tables and their relationships:

```
users
  id, email, password_hash, display_name, avatar_url, role (viewer/creator)
  kyc_status (none/pending/verified/rejected), kyc_verified_at
  created_at, updated_at

wallets
  id, user_id (FK), public_key, encrypted_private_key, encryption_iv
  created_at
  -- ONE wallet per user, created at signup

creator_profiles
  id, user_id (FK), bio, banner_url, social_links
  token_mint_address (nullable -- set after token launch)
  token_launched_at, last_token_launch_at (for cooldown enforcement)

tokens
  id, creator_profile_id (FK), mint_address, name, symbol, image_url
  bonding_curve_address, initial_supply, creator_allocation_pct
  created_at

vesting_schedules
  id, token_id (FK), beneficiary_wallet (public_key)
  total_amount, cliff_end_at, vest_end_at
  claimed_amount, last_claimed_at

posts
  id, creator_id (FK), content_type (text/image/video)
  text_content, media_url (encrypted/signed URL in storage)
  access_level (public/gated/premium/ppv)
  gate_threshold (token amount for gated), burn_cost (for premium/ppv)
  created_at

transactions (off-chain ledger, mirrors on-chain)
  id, user_id, type (buy/sell/burn/tip/withdraw)
  token_mint, amount, sol_amount
  solana_signature, status (pending/confirmed/failed)
  created_at

content_access_log
  id, user_id, post_id, access_type (hold_verified/burned)
  burn_signature (if applicable), accessed_at
```

**Key design decisions:**
- Encrypted private keys live in the same database as user data but are encrypted with AES-256-GCM using a key from an external KMS (AWS KMS, GCP KMS, or at minimum an environment variable for early development). The encryption key NEVER lives in the database.
- The `transactions` table is an off-chain mirror for fast querying. The on-chain Solana state is the source of truth; the off-chain table is a read cache updated via Helius webhooks.
- Content URLs in the `posts` table point to R2/S3 objects. Actual access is controlled by generating short-lived signed URLs server-side after verifying token holdings.

### 4. Solana Program (Anchor / Rust)

The on-chain program handles all financial logic. It is the source of truth for token economics.

**Program accounts (PDAs):**

| PDA | Seeds | Purpose |
|---|---|---|
| `GlobalConfig` | `["global"]` | Platform-wide settings: fee percentages, fee recipient, admin authority |
| `BondingCurve` | `["bonding-curve", mint]` | Per-token curve state: virtual/real SOL reserves, virtual/real token reserves, creator address, complete flag |
| `CreatorVault` | `["creator-vault", mint]` | Accumulates creator's trade fee earnings in SOL |
| `PlatformVault` | `["platform-vault"]` | Accumulates platform fee earnings |
| `VestingAccount` | `["vesting", mint, beneficiary]` | Tracks creator token vesting: total, claimed, cliff timestamp, end timestamp |

**Instructions:**

| Instruction | What It Does | Key Accounts |
|---|---|---|
| `initialize` | Sets up GlobalConfig (admin-only, one-time) | admin, global_config |
| `create_token` | Mints SPL token, creates BondingCurve PDA, seeds initial reserves, mints creator allocation to VestingAccount | creator, mint, bonding_curve, vesting_account, metadata |
| `buy` | Calculates tokens from SOL input using curve math, mints tokens, updates reserves, distributes fees | buyer, bonding_curve, mint, creator_vault, platform_vault |
| `sell` | Calculates SOL from token input, burns tokens, updates reserves, distributes fees | seller, bonding_curve, mint, creator_vault, platform_vault |
| `burn_for_access` | Burns tokens, returns SOL from curve to platform (or partially to creator), logs burn event | burner, bonding_curve, mint |
| `claim_vested` | Releases vested tokens to creator based on cliff + linear schedule | creator, vesting_account, mint |
| `withdraw_creator_fees` | Transfers accumulated SOL from CreatorVault to creator wallet | creator, creator_vault |
| `donate_sol` | Transfers SOL directly from donor to creator wallet | donor, creator_wallet |
| `donate_token` | Transfers creator tokens from donor to creator wallet | donor, creator_wallet, token_accounts |

**Bonding curve math (constant product variant):**

```
price = virtual_sol_reserves / virtual_token_reserves
tokens_out = real_token_reserves - (virtual_sol_reserves * virtual_token_reserves) / (virtual_sol_reserves + sol_in_after_fees)
```

Fees are deducted from SOL input before curve calculation:
- Platform fee: X% (configurable in GlobalConfig)
- Creator fee: Y% (sent to CreatorVault)
- Net SOL enters the curve reserves

### 5. External Services

| Service | Role | Integration Pattern |
|---|---|---|
| **Helius RPC** | Solana RPC endpoint + DAS API for token balance queries + Webhooks for on-chain event notifications | Server-side only. All RPC calls go through the Next.js server layer. Webhooks hit API routes. |
| **Helius DAS API** | `getAssetsByOwner` to check if a user holds enough tokens for gated content. `getTokenAccounts` for holder counts. | Called server-side before serving content. Cache results for 30-60 seconds to avoid excessive RPC calls. |
| **Helius Webhooks** | Push notifications for on-chain events (token trades, burns, transfers) | API route receives webhook, updates off-chain `transactions` table and any derived state (leaderboards, earnings). |
| **Cloudflare R2 / AWS S3** | Media storage for creator content (images, videos) | Uploads go through server layer. Content served via signed URLs with short TTL (e.g., 15 minutes). |
| **KYC Provider** (e.g., Persona, Sumsub) | Identity verification for creators before token launch | Server-side integration. KYC status stored in DB. Webhook for async verification completion. |

## Data Flow Diagrams

### Flow 1: User Signs Up and Gets Wallet

```
1. User submits signup form (email + password)
2. Server Action: create user in DB, hash password
3. Server Action: generate Solana Keypair
4. Server Action: encrypt private key with AES-256-GCM (key from KMS)
5. Server Action: store public_key + encrypted_private_key in wallets table
6. Return: user session + public wallet address displayed in UI
```

**Security note:** The Keypair exists in server memory only during step 3-4. After encryption, the raw bytes are zeroed. The KMS key is fetched per-operation, never cached long-term in memory.

### Flow 2: User Buys Creator Tokens

```
1. User clicks "Buy" with SOL amount on creator page
2. Server Action: authenticate user, load their encrypted wallet key
3. Server Action: decrypt private key using KMS
4. Server Action: build Solana transaction (buy instruction to bonding curve program)
5. Server Action: sign transaction with user's keypair
6. Server Action: submit transaction to Helius RPC, await confirmation
7. Server Action: zero key bytes in memory
8. Server Action: write pending transaction to off-chain DB
9. Helius Webhook: confirms transaction, updates DB record to "confirmed"
10. UI: updates token balance display
```

### Flow 3: Token-Gated Content Access (Hold-to-View)

```
1. User navigates to creator's feed
2. Server Component: fetch posts from DB
3. Server Component: for gated posts, call Helius DAS API
   -> getAssetsByOwner(user_wallet, { showFungible: true })
   -> check if user holds >= gate_threshold of creator's token
4. For accessible posts: generate signed R2/S3 URL (15-min TTL)
5. For inaccessible posts: render blurred placeholder + "Hold X tokens to unlock"
6. Return: mixed feed of accessible + locked content
```

### Flow 4: Burn-to-Unlock Premium Content

```
1. User clicks "Burn X tokens to unlock" on premium post
2. Server Action: authenticate, decrypt wallet key
3. Server Action: build burn_for_access transaction
   -> Burns X tokens from user's account
   -> SOL returns from curve to platform/creator per fee split
4. Server Action: sign + submit transaction
5. Server Action: on confirmation, write to content_access_log
6. Server Action: generate signed URL for content
7. UI: reveals content, marks as permanently unlocked for this user
```

### Flow 5: Creator Launches Token

```
1. Creator completes KYC (async, may take hours/days)
2. Creator fills token launch form (name, symbol, image)
3. Server Action: verify KYC status == "verified"
4. Server Action: verify cooldown (last_token_launch_at + 90 days < now)
5. Server Action: decrypt creator's wallet key
6. Server Action: build create_token transaction
   -> Creates SPL mint
   -> Creates BondingCurve PDA with initial reserves
   -> Mints creator allocation (10%) to VestingAccount PDA
   -> Creates token metadata via Metaplex
7. Server Action: sign + submit transaction
8. Server Action: store mint_address, bonding_curve_address in DB
9. Creator's token is now live and tradeable
```

### Flow 6: Creator Claims Vested Tokens

```
1. Creator views vesting dashboard
2. Server Component: read VestingAccount PDA on-chain
   -> Calculate claimable amount based on cliff + linear schedule
3. Creator clicks "Claim"
4. Server Action: build claim_vested transaction
5. Server Action: sign + submit
6. Tokens transferred from VestingAccount to creator's wallet
```

## On-Chain vs Off-Chain Boundary

This is the most important architectural decision. Getting this boundary wrong causes either:
- Too much on-chain: expensive, slow, hard to iterate
- Too much off-chain: trust assumptions, inconsistency risks

| Data | Location | Rationale |
|---|---|---|
| Token supply, reserves, prices | **On-chain** (BondingCurve PDA) | Financial truth must be trustless |
| Trade execution (buy/sell/burn) | **On-chain** (program instructions) | Value transfer must be atomic and verifiable |
| Fee accumulation | **On-chain** (CreatorVault, PlatformVault) | Earnings must be auditable |
| Vesting state | **On-chain** (VestingAccount PDA) | Prevents creator from bypassing vesting |
| Token metadata (name, symbol) | **On-chain** (Metaplex) | Standard, discoverable by wallets/explorers |
| User profiles, bios | **Off-chain** (DB) | Mutable, no financial significance |
| Content (posts, media) | **Off-chain** (DB + R2/S3) | Too large for chain, needs fast retrieval |
| Content access rules (thresholds) | **Off-chain** (DB) | Creator-configurable, no value transfer |
| Access verification | **Hybrid** | Check on-chain balance, enforce off-chain |
| KYC status | **Off-chain** (DB) | Sensitive PII, regulatory requirement to store securely |
| Transaction history (for UI) | **Off-chain mirror** (DB, synced via webhooks) | Fast queries, but on-chain is source of truth |
| Leaderboards, rankings | **Off-chain** (DB, computed) | Derived from on-chain data, cached for performance |

## Patterns to Follow

### Pattern 1: Server-Side Transaction Signing (Custodial)

**What:** All Solana transactions are built and signed on the Next.js server. Users never interact with keys.

**When:** Every transaction (buy, sell, burn, tip, withdraw, claim).

**Why:** This is the core UX proposition -- users don't need wallets. The tradeoff is custodial risk, mitigated by encryption + KMS.

```typescript
// Server Action pattern (pseudocode)
async function buyTokens(mintAddress: string, solAmount: number) {
  "use server";

  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const wallet = await db.wallets.findByUserId(session.userId);
  const decryptedKey = await decryptPrivateKey(wallet.encrypted_private_key, wallet.encryption_iv);

  try {
    const keypair = createKeyPairSignerFromBytes(decryptedKey);
    const tx = buildBuyTransaction(mintAddress, solAmount, keypair.address);
    const signedTx = await signTransaction(tx, keypair);
    const signature = await sendTransaction(signedTx, heliusRpc);

    await db.transactions.create({
      userId: session.userId,
      type: "buy",
      tokenMint: mintAddress,
      solAmount,
      signature,
      status: "pending",
    });

    return { signature };
  } finally {
    zeroMemory(decryptedKey); // Critical: wipe key from memory
  }
}
```

### Pattern 2: Webhook-Driven State Sync

**What:** Use Helius webhooks to keep off-chain DB in sync with on-chain state, rather than polling.

**When:** After every on-chain transaction that affects UI state.

**Why:** Eliminates polling overhead, provides near-real-time updates, handles transactions submitted outside the platform (e.g., if someone transfers tokens via a block explorer).

```
On-chain event -> Helius Webhook -> API Route -> Update DB -> Invalidate cache
```

### Pattern 3: Signed URL Content Delivery

**What:** Never expose permanent media URLs. Generate short-lived signed URLs after verifying token holdings.

**When:** Every content access request for gated/premium content.

**Why:** Prevents URL sharing that bypasses token gates. Even if a URL leaks, it expires in 15 minutes.

### Pattern 4: Optimistic UI with Confirmation

**What:** Show transaction as "pending" immediately, update to "confirmed" when webhook arrives.

**When:** Any user-initiated transaction (buy, sell, burn, tip).

**Why:** Solana confirms in ~400ms, but the full pipeline (submit -> confirm -> webhook -> DB update) takes 1-3 seconds. Optimistic UI keeps the experience snappy.

### Pattern 5: Balance Caching with Short TTL

**What:** Cache Helius DAS API balance responses for 30-60 seconds.

**When:** Token gate checks on feed pages.

**Why:** A feed page might check balances for 20+ posts. Without caching, that is 20+ RPC calls per page load. Cache per (user_wallet, token_mint) pair.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side Balance Checks for Access Control

**What:** Checking token balance in the browser and conditionally rendering content.

**Why bad:** Trivially bypassed. Anyone can modify client-side JavaScript or directly call the API endpoint.

**Instead:** All access control checks happen server-side. The client never receives content it should not display.

### Anti-Pattern 2: Storing Raw Private Keys

**What:** Storing unencrypted private keys in the database or environment variables.

**Why bad:** A single database breach exposes every user's wallet and funds.

**Instead:** AES-256-GCM encryption with KMS-managed keys. The encryption key never touches the database. Consider HSM/KMS for production.

### Anti-Pattern 3: On-Chain Content Storage

**What:** Storing content hashes, access lists, or content metadata on-chain.

**Why bad:** Expensive (rent costs), slow to update, unnecessary. Content access is derived from token balance which is already on-chain.

**Instead:** Content metadata lives in the database. Access control reads on-chain balances but enforces off-chain.

### Anti-Pattern 4: Single Global Fee Wallet

**What:** Having all platform fees and creator fees accumulate in one wallet.

**Why bad:** Accounting nightmare. Cannot attribute earnings per creator. Single point of failure.

**Instead:** Per-creator PDAs (CreatorVault) for creator fees. Separate PlatformVault for platform fees. Clean, auditable separation.

### Anti-Pattern 5: Synchronous Transaction Confirmation in UI

**What:** Blocking the UI until a Solana transaction is fully confirmed.

**Why bad:** Even at ~400ms finality, the full round-trip through RPC can occasionally take several seconds. UI feels frozen.

**Instead:** Optimistic UI. Submit transaction, show pending state, update via webhook or polling fallback.

## Build Order (Dependency Graph)

Components must be built in an order that respects their dependencies:

```
Phase 1: Foundation
  [Auth System] -> [Database Schema] -> [Custodial Wallets]
  No on-chain dependency yet. Get users signing up and getting wallets.

Phase 2: On-Chain Core
  [Anchor Program: GlobalConfig + BondingCurve + Buy/Sell]
  [Helius RPC Integration]
  [Server-side transaction signing pipeline]
  Requires: Phase 1 (wallets exist to sign transactions)

Phase 3: Creator Flow
  [KYC Integration] -> [Token Launch (create_token instruction)]
  [Creator Profiles]
  [Vesting Schedule (VestingAccount + claim_vested)]
  Requires: Phase 2 (bonding curve program deployed)

Phase 4: Content + Gating
  [Content Upload + Storage (R2/S3)]
  [Token Gate Verification (Helius DAS API)]
  [Burn-to-Unlock Flow]
  Requires: Phase 2 (tokens exist to gate against), Phase 3 (creators post content)

Phase 5: Economy
  [Donation System (SOL + token tips)]
  [Creator Fee Withdrawal]
  [Platform Fee Collection]
  [Withdrawal to External Wallet]
  Requires: Phase 2-3 (tokens + creator vaults exist)

Phase 6: Discovery + Polish
  [Search + Browse]
  [Token Leaderboard / Rankings]
  [Helius Webhook State Sync]
  [Real-time Price Display]
  Requires: Phase 2-5 (data exists to discover)
```

**Critical path:** Auth -> Wallets -> Anchor Program -> Token Launch -> Content + Gating. Everything else can be parallelized around this spine.

## Security Boundaries

| Boundary | Threat | Mitigation |
|---|---|---|
| Encrypted wallet keys | DB breach exposes all funds | AES-256-GCM + KMS. Encryption key separate from DB. Key rotation plan. |
| Server memory during signing | Memory dump exposes keys | Zero key bytes immediately after signing. Short-lived decryption. |
| Content URLs | URL sharing bypasses gates | Signed URLs with 15-min TTL. Re-verify holdings on each access. |
| KYC data | PII exposure | Encrypt at rest. Minimize stored data. Prefer KYC provider holding docs. |
| Admin operations | Rogue admin drains platform vault | Multi-sig or time-locked admin operations on GlobalConfig. |
| Bonding curve program | Bug allows draining reserves | Thorough audit. Program is upgradeable initially, freeze after confidence. |
| Helius webhooks | Spoofed webhooks fake transactions | Verify webhook signatures. Cross-check with on-chain state for high-value operations. |

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---|---|---|---|
| DB load | Single Postgres, no issues | Connection pooling, read replicas | Sharding or managed service (PlanetScale, Neon) |
| RPC calls | Direct Helius calls | DAS API caching (30s TTL) | Dedicated Helius plan, aggressive caching, batch queries |
| Media storage | R2 free tier sufficient | R2 standard, CDN in front | CDN + edge caching, video transcoding pipeline |
| Transaction throughput | Helius shared RPC | Helius dedicated node | Multiple RPC endpoints, queue-based transaction submission |
| Key decryption | In-process KMS call | KMS call per transaction | Consider key caching (encrypted in memory) with short TTL, or MPC approach |
| Content access checks | Inline DAS API call | Cached balance checks | Pre-computed access tables, updated via webhooks |

## Sources

- [Helius DAS API Documentation](https://www.helius.dev/docs/das-api)
- [Helius Blog: Token Gating on Solana](https://www.helius.dev/blog/token-gating-on-solana-mobile-tutorial)
- [Helius Blog: Web3.js 2.0 SDK](https://www.helius.dev/blog/how-to-start-building-with-the-solana-web3-js-2-0-sdk)
- [Pump.fun Bonding Curve Mechanism (DeepWiki)](https://deepwiki.com/pump-fun/pump-public-docs/3.1-pump-bonding-curve-mechanism)
- [Pump.fun PDA Architecture (GitHub)](https://github.com/m4rcu5o/Solana-pumpfun-smart-contract)
- [Anchor Framework Docs](https://www.anchor-lang.com/docs)
- [Rally DFS Token Bonding Curve](https://github.com/rally-dfs/token-bonding-curve)
- [Shorthusk Vesting Program (Anchor 0.31.1)](https://github.com/shorthusk/shorthusk-vesting)
- [Bonfida Token Vesting](https://github.com/Bonfida/token-vesting)
- [Solana Keypair Docs](https://solana.com/developers/cookbook/wallets/create-keypair)
- [MPC Wallet Architecture (Fireblocks)](https://www.fireblocks.com/what-is-mpc)
- [MPC Wallets Technical Guide (Stackup)](https://www.stackup.fi/resources/mpc-wallets-a-complete-technical-guide)
- [AWS Nitro Enclaves for MPC Wallets](https://aws.amazon.com/blogs/web3/build-secure-multi-party-computation-mpc-wallets-using-aws-nitro-enclaves/)
- [TASSHUB Creator Platform on Solana](https://www.globenewswire.com/news-release/2025/04/23/3066083/0/en/TASSHUB-Debuts-Market-for-Creators-on-Solana-it-s-484-up-in-just-24-Hours-After-Launch.html)

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Overall architecture (3-tier) | HIGH | Standard pattern for custodial web3 apps, well-documented |
| Bonding curve PDA structure | HIGH | Directly informed by pump.fun architecture, multiple open-source implementations |
| Custodial wallet encryption | MEDIUM | AES-256 + KMS is sound for v1, but production should evaluate MPC/HSM. Industry is moving toward MPC. |
| Helius DAS API for gating | HIGH | Official Helius docs confirm getAssetsByOwner supports fungible tokens |
| Vesting as separate PDA | HIGH | Multiple Anchor vesting implementations confirm this pattern |
| Signed URL content delivery | HIGH | Standard cloud storage pattern, not crypto-specific |
| Webhook state sync | MEDIUM | Helius webhooks are well-documented but webhook reliability at scale needs monitoring/retry logic |
| Build order | MEDIUM | Based on dependency analysis, but real-world iteration may shift priorities |
