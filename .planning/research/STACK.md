# Technology Stack

**Project:** Baremint
**Researched:** 2026-01-31
**Overall Confidence:** MEDIUM-HIGH

---

## Already Specified (Locked In)

These choices are fixed by the project owner. No alternatives considered.

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.6 | Full-stack framework (already installed) |
| React | 19.2.3 | UI library (already installed) |
| Tailwind CSS | v4 | Styling (already installed) |
| TypeScript | ^5 | Type safety (already installed) |
| shadcn/ui | latest | Component library |
| Solana | mainnet | Blockchain network |
| Helius | - | RPC provider, webhooks, DAS API |
| Metaplex | - | Token metadata standard |

---

## Recommended Stack (Gaps to Fill)

### Database

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Neon Postgres | - | Primary database | Serverless Postgres with scale-to-zero, instant branching for dev/staging, native Drizzle integration, acquired by Databricks ($1B) signaling long-term viability. Zero-config connection pooling. Free tier generous for development. | HIGH |
| Drizzle ORM | 0.45.1 (stable) | Database ORM | SQL-first, ~7kb bundle, zero dependencies, excellent serverless/edge performance. Native Neon driver support via `@neondatabase/serverless`. Type-safe schema defined in TypeScript. Better cold-start than Prisma in serverless. | HIGH |
| Drizzle Kit | 0.45.x | Migrations | Generates SQL migration files from schema diffs. Paired with `drizzle-kit push` for rapid local dev, `drizzle-kit generate` + `drizzle-kit migrate` for production. | HIGH |

**Why not Prisma?** Heavier cold starts in serverless (~300ms+ engine startup), requires binary query engine, larger bundle. Drizzle is the better fit for Next.js edge/serverless routes. Prisma's DX advantage (Studio, guided migrations) is less relevant for a team comfortable with SQL.

**Why not Supabase?** Supabase is a full BaaS (auth, storage, realtime) -- we only need the database, and we have specific needs for auth (custodial wallets + KYC) and storage (R2). Using Supabase for just Postgres adds unnecessary abstraction. Neon is purpose-built for the serverless Postgres use case.

### Authentication

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Better Auth | latest | Authentication library | The Auth.js (NextAuth) team officially joined Better Auth in Sept 2025 and recommends it for new projects. TypeScript-first, database-backed sessions, built-in Drizzle adapter (`drizzleAdapter`), plugin system for MFA/passkeys. Credential auth (email/password) is first-class, unlike Auth.js where it was always a second-class citizen. Social login providers built in. | HIGH |

**Why not Auth.js v5 (NextAuth)?** Auth.js development team joined Better Auth. Auth.js will receive security patches only. Better Auth is the recommended path forward for new projects starting in 2025/2026. Better Auth also has cleaner credential-based auth, which we need for email/password signup.

**Why not Clerk/Auth0?** Vendor lock-in, recurring cost per MAU, and we need deep control over the auth flow for custodial wallet creation on signup. Better Auth gives us full control at $0 ongoing cost.

### File Storage

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Cloudflare R2 | - | Media storage (images, videos) | Zero egress fees (massive savings for media-heavy platform), S3-compatible API (use `@aws-sdk/client-s3`), 20-40% faster than S3 for media delivery (Cloudflare edge network), free tier includes 10GB storage + 10M reads/mo. A creator platform will serve enormous amounts of media -- egress costs with S3 would be a business-killer. | HIGH |
| `@aws-sdk/client-s3` | latest | S3-compatible SDK for R2 | R2 is fully S3-API compatible. Use the official AWS SDK rather than a Cloudflare-specific client for portability. | HIGH |
| `@aws-sdk/s3-request-presigner` | latest | Presigned upload URLs | Client uploads directly to R2 via presigned URLs, bypassing the Next.js server entirely. Handles files up to 5GB. Essential for video uploads. | HIGH |
| `@aws-sdk/lib-storage` | latest | Multipart uploads | For files >5MB, use multipart upload. Required for video content. | MEDIUM |

**Why not UploadThing?** Adds $25+/month managed service cost, vendor lock-in, and less control over storage. Presigned URLs to R2 are straightforward to implement and give us zero egress costs. The extra setup is worth the long-term savings for a media-heavy platform.

**Why not AWS S3 directly?** Egress fees. For a creator platform serving 10TB/month of media content, R2 costs ~$15/month vs S3's ~$891/month in egress alone. This is the single biggest cost optimization for this type of platform.

### Solana SDK & Tooling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@solana/kit` | 3.0.3 | Solana JavaScript SDK | The official successor to `@solana/web3.js`. Tree-shakable, zero dependencies, native BigInt, ~30% smaller bundles than v1. All new Solana projects should use Kit. | HIGH |
| `@helius-dev/kite` | 1.0.1 | High-level Solana helpers | Built on `@solana/kit` by the Helius team. One-shot functions for common tasks (create wallet, transfer SOL, create token with metadata, airdrop). Reduces boilerplate significantly. No Helius lock-in -- works with any RPC but takes advantage of Helius features (priority fee estimates, low-latency confirms) when available. | MEDIUM |
| `@metaplex-foundation/mpl-token-metadata` | 3.4.0 | Token metadata (JS client) | The standard for attaching name/symbol/image to SPL tokens on Solana. Required for creating branded creator tokens. Uses Umi framework. | HIGH |
| `@metaplex-foundation/umi` | latest | Metaplex framework | Required by mpl-token-metadata. Provides a unified interface for Metaplex programs. | HIGH |
| Anchor Framework | 0.32.1 | Solana program framework | For writing the custom bonding curve smart contract. The de facto standard for Solana program development. Provides account validation, serialization, and testing infrastructure. | HIGH |

**Critical compatibility note:** Anchor's TypeScript client (`@anchor-lang/core`) is NOT compatible with `@solana/kit` (only works with legacy `@solana/web3.js` v1). To interact with the Anchor bonding curve program from the frontend, use **Codama** to generate Kit-compatible TypeScript clients from the Anchor IDL, or use **Kite** which is designed to work with Anchor programs via Codama-generated clients.

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Codama | latest | IDL-to-client generator | Generates `@solana/kit`-compatible TypeScript clients from Anchor IDLs. Bridge between Anchor programs and the modern Kit SDK. | MEDIUM |

**Why not `@solana/web3.js` v1?** Maintenance-only, larger bundle, class-based API that doesn't tree-shake well. v1 is legacy; Kit is the present and future.

**Why not `gill`?** Gill wraps `@solana/kit` with the same API surface but adds extra helpers. Kite does the same but is maintained by Helius (our RPC provider) and integrates with Helius-specific features. Prefer Kite for our stack.

### Bonding Curve Smart Contract

| Technology | Purpose | Why | Confidence |
|------------|---------|-----|------------|
| Custom Anchor program (Rust) | On-chain bonding curve logic | Pump.fun's bonding curve model (constant product x*y=k) is well-documented with open-source forks available as reference. Our curve is permanent (no graduation/migration to AMM), which is simpler than pump.fun. Must handle: buy, sell, fee collection, burn mechanics. | MEDIUM |

**Reference implementations:**
- [m4rcu5o/Solana-pumpfun-smart-contract](https://github.com/m4rcu5o/Solana-pumpfun-smart-contract) -- Pump.fun fork with bonding curve + Meteora migration
- [rally-dfs/token-bonding-curve](https://github.com/rally-dfs/token-bonding-curve) -- Linear price curve using integral-based pricing
- [seiji0411/bonding_curve](https://github.com/seiji0411/bonding_curve) -- Anchor-based bonding curve program

**Key design difference from pump.fun:** Baremint tokens are permanent bonding curves -- they never "graduate" to an AMM. This simplifies the contract (no migration logic) but means the curve must be designed for long-term stability rather than speculative launch dynamics.

### KYC Provider

| Technology | Purpose | Why | Confidence |
|------------|---------|-----|------------|
| Sumsub | Creator identity verification | Best fit for crypto platforms: Gartner Magic Quadrant Leader (2025), built-in blockchain analysis and wallet screening, Travel Rule compliance, drag-and-drop flow builder (no-code). Web SDK + Mobile SDK. REST API for backend verification status checks. 200+ countries. Named specifically for fintech/crypto use cases. | MEDIUM |

**Why not Persona?** More powerful orchestration but higher setup complexity. Persona is better for teams with dedicated compliance staff building complex multi-step flows. Sumsub's no-code flow builder is better for a startup that needs KYC working quickly.

**Why not Veriff?** Cheaper at low volumes but less crypto-specific features. No blockchain analysis or Travel Rule compliance built in. Sumsub is purpose-built for crypto platforms.

### Encryption & Key Management

| Technology | Purpose | Why | Confidence |
|------------|---------|---------|------------|
| Node.js `crypto` (built-in) | AES-256-GCM encryption of custodial wallet private keys | Native Node.js module, no external dependency. AES-256-GCM provides authenticated encryption (confidentiality + integrity). Keys encrypted at rest in Postgres, decrypted only in-memory for transaction signing. | HIGH |

**Architecture for custodial wallets:**
- Generate Solana keypair on signup using `@solana/kit` `generateKeyPairSigner()`
- Encrypt private key with AES-256-GCM using a key derived from `WALLET_ENCRYPTION_KEY` env var
- Store encrypted key + IV + auth tag in Postgres
- Decrypt only when signing transactions server-side
- Never expose private keys to the client

**Why not a KMS (AWS KMS, Hashicorp Vault)?** Adds infrastructure complexity and cost for an MVP. The encryption key stored as an env var is sufficient for launch. Migration to KMS is straightforward when needed -- the encryption/decryption interface stays the same.

### Supporting Libraries

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| `zod` | latest | Schema validation (API inputs, form data, env vars) | HIGH |
| `nanoid` | latest | Unique ID generation (file names, short codes) | HIGH |
| `date-fns` | latest | Date formatting/manipulation | HIGH |
| `sonner` | latest | Toast notifications (pairs with shadcn/ui) | HIGH |
| `nuqs` | latest | Type-safe URL search params for Next.js | MEDIUM |
| `lucide-react` | latest | Icon library (used by shadcn/ui) | HIGH |
| `@tanstack/react-query` | latest | Client-side data fetching/caching | HIGH |
| `sharp` | latest | Image processing (thumbnails, optimization) | HIGH |
| `bull` / `bullmq` | latest | Job queue for async tasks (video processing, webhook delivery) | MEDIUM |
| `ioredis` | latest | Redis client (for BullMQ job queue) | MEDIUM |

### Dev Dependencies

| Library | Purpose | Confidence |
|---------|---------|------------|
| `drizzle-kit` | Database migrations and studio | HIGH |
| `@better-auth/cli` | Auth schema generation | HIGH |
| `prettier` + `prettier-plugin-tailwindcss` | Code formatting with Tailwind class sorting | HIGH |
| `vitest` | Unit/integration testing | HIGH |
| `@playwright/test` | E2E testing | MEDIUM |

---

## Alternatives Considered (Full Matrix)

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Database | Neon Postgres | Supabase | Only need DB, not full BaaS; Neon is cheaper for pure Postgres |
| Database | Neon Postgres | PlanetScale | MySQL not Postgres; less ecosystem alignment with Drizzle/Next.js |
| ORM | Drizzle | Prisma | Heavier cold starts, binary engine, bigger bundle |
| Auth | Better Auth | Auth.js v5 | Auth.js team joined Better Auth; maintenance-only going forward |
| Auth | Better Auth | Clerk | Vendor lock-in, per-MAU cost, less control over custodial wallet flow |
| Storage | Cloudflare R2 | AWS S3 | Egress fees prohibitive for media-heavy platform |
| Storage | Presigned URLs | UploadThing | Vendor lock-in, monthly cost, less control |
| Solana SDK | @solana/kit | @solana/web3.js v1 | Legacy, maintenance-only, larger bundles |
| Solana helpers | Kite | gill | Kite maintained by our RPC provider (Helius) |
| KYC | Sumsub | Persona | Simpler setup, crypto-native features, Gartner Leader |
| KYC | Sumsub | Veriff | Less crypto-specific, no blockchain analysis |
| Program framework | Anchor | Native Rust | Anchor reduces boilerplate, provides security checks |

---

## Installation Commands

```bash
# Core dependencies
npm install @solana/kit @helius-dev/kite @metaplex-foundation/mpl-token-metadata @metaplex-foundation/umi
npm install drizzle-orm @neondatabase/serverless better-auth
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @aws-sdk/lib-storage
npm install zod nanoid date-fns sonner nuqs lucide-react @tanstack/react-query sharp

# Dev dependencies
npm install -D drizzle-kit @better-auth/cli vitest prettier prettier-plugin-tailwindcss

# Job queue (when needed)
npm install bullmq ioredis
```

```bash
# Anchor / Solana program tooling (separate from the Next.js app)
# Install via: cargo install --git https://github.com/solana-foundation/anchor avm --force
# Then: avm install 0.32.1 && avm use 0.32.1
```

---

## Environment Variables Required

```env
# Database
DATABASE_URL=postgresql://...@....neon.tech/neondb?sslmode=require

# Auth
BETTER_AUTH_SECRET=<random-32-char-string>
BETTER_AUTH_URL=http://localhost:3000

# Cloudflare R2
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
R2_BUCKET_NAME=baremint-media
R2_PUBLIC_URL=https://media.baremint.com

# Solana
HELIUS_API_KEY=<helius-api-key>
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=<key>
SOLANA_NETWORK=devnet

# Custodial Wallet Encryption
WALLET_ENCRYPTION_KEY=<32-byte-hex-key>

# KYC (Sumsub)
SUMSUB_APP_TOKEN=<app-token>
SUMSUB_SECRET_KEY=<secret-key>
```

---

## Sources

### HIGH Confidence (Official docs, npm registry)
- [@solana/kit npm](https://www.npmjs.com/package/@solana/kit) -- v3.0.3, successor to @solana/web3.js
- [Anza: Solana JS SDK 2.0 Release](https://www.anza.xyz/blog/solana-web3-js-2-release)
- [Anchor Releases](https://github.com/solana-foundation/anchor/releases) -- v0.32.1
- [Metaplex Token Metadata](https://developers.metaplex.com/token-metadata) -- JS client v3.4.0
- [Drizzle ORM npm](https://www.npmjs.com/package/drizzle-orm) -- v0.45.1
- [Drizzle + Neon setup](https://orm.drizzle.team/docs/connect-neon)
- [Better Auth Next.js integration](https://www.better-auth.com/docs/integrations/next)
- [Better Auth installation](https://www.better-auth.com/docs/installation)
- [Helius Platform](https://www.helius.dev) -- RPC, webhooks, DAS API
- [@helius-dev/kite npm](https://www.npmjs.com/package/@helius-dev/kite) -- v1.0.1
- [Cloudflare R2 S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/)

### MEDIUM Confidence (Multiple credible sources agree)
- [Auth.js joins Better Auth discussion](https://github.com/nextauthjs/next-auth/discussions/13252)
- [Drizzle vs Prisma comparison (Bytebase)](https://www.bytebase.com/blog/drizzle-vs-prisma/)
- [Cloudflare R2 vs S3 (ThemeDev)](https://themedev.net/blog/cloudflare-r2-vs-aws-s3/)
- [R2 performance benchmarks (Cloudflare blog)](https://blog.cloudflare.com/r2-is-faster-than-s3/)
- [Sumsub KYC for crypto](https://sumsub.com/kyc-compliance/)
- [Neon Postgres overview (Bytebase)](https://www.bytebase.com/blog/neon-vs-supabase/)
- [Kite + Codama for Anchor programs](https://solanakite.org/docs)
- [Pump.fun bonding curve mechanics](https://blockchain.oodles.io/pump-fun/)

### LOW Confidence (Needs validation during implementation)
- [Pumpfun smart contract fork](https://github.com/m4rcu5o/Solana-pumpfun-smart-contract) -- Reference only, needs audit before any code reuse
- Kite v1.0.1 is marked as "preview" by Helius -- may have bugs, fallback to raw `@solana/kit` if issues arise
- BullMQ/Redis requirement depends on whether video processing is handled in-app or via external service
