# Phase 1: Authentication & Wallets - Research

**Researched:** 2026-01-31
**Domain:** Authentication, custodial Solana wallets, 2FA, OAuth, encrypted key storage
**Confidence:** HIGH

## Summary

Phase 1 builds the authentication foundation (email/password, Google/Twitter OAuth, TOTP 2FA) and a custodial Solana wallet system (auto-created on signup, encrypted private keys, balance display, SOL withdrawals). The locked stack is Next.js 16 + Better Auth + Drizzle ORM + Neon Postgres + @solana/kit + Helius RPC.

Better Auth (v1.4.x) provides a comprehensive plugin-based auth framework with native Drizzle adapter, built-in 2FA/TOTP plugin, and OAuth social providers -- all fitting the requirements exactly. The Solana side uses @solana/kit (v3.x, the successor to @solana/web3.js v2) for keypair generation and transaction signing, with Helius SDK v2.x for RPC calls. Private keys are encrypted with AES-256-GCM using Node.js native crypto module before database storage.

**Primary recommendation:** Use Better Auth with its Drizzle adapter and twoFactor plugin as the auth backbone, @solana/kit for wallet operations, and Node.js crypto for AES-256-GCM encryption. CoinGecko free API for SOL/USD conversion.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-auth | ^1.4.15 | Auth framework (email/password, OAuth, sessions) | TypeScript-first, plugin architecture, native Drizzle adapter, built-in 2FA |
| drizzle-orm | ^0.45.1 | Database ORM | Type-safe, lightweight (7.4kb), native Neon support, schema-as-code |
| drizzle-kit | ^0.45.x | Migration tooling | Companion to drizzle-orm for schema generation and migrations |
| @neondatabase/serverless | latest | Neon Postgres driver | Official serverless driver for Neon, works with Drizzle |
| @solana/kit | ^3.0.3 | Solana SDK (keypair, transactions, signing) | Official Solana JS SDK (replaces @solana/web3.js v2), modular, tree-shakeable |
| helius-sdk | ^2.0.5 | Helius RPC client | Official Helius SDK, built on @solana/kit, provides RPC + webhooks |
| shadcn/ui | latest | UI components | Project constraint, Tailwind-based, copy-paste components |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| qrcode | ^1.5.x | QR code generation for TOTP setup | Rendering TOTP URI as scannable QR code |
| @t3-oss/env-nextjs | latest | Environment variable validation | Type-safe env vars at build time |
| zod | ^3.x | Schema validation | Form validation, API input validation, env validation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-auth | next-auth/auth.js v5 | Better Auth has cleaner plugin system; next-auth is more mature but more complex |
| drizzle-orm stable | drizzle-orm@beta (v1.0) | v1.0 has breaking changes, Better Auth adapter has open compatibility issue with v1.0 -- stay on stable |
| @solana/kit | @solana/web3.js v1.x | v1 is legacy, not tree-shakeable, larger bundle. Kit is the official successor |
| CoinGecko API | Jupiter Price API | CoinGecko is simpler for just SOL/USD; Jupiter is better for SPL token prices (needed later) |

**Installation:**
```bash
npm install better-auth drizzle-orm @neondatabase/serverless @solana/kit helius-sdk zod qrcode
npm install -D drizzle-kit @types/qrcode
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    (auth)/
      auth/page.tsx           # Unified auth page (split-screen layout)
    (dashboard)/
      dashboard/
        page.tsx              # Dashboard with wallet sidebar widget
        settings/
          page.tsx            # Settings including 2FA setup
        withdraw/
          page.tsx            # SOL withdrawal flow (step 1: enter details)
          review/page.tsx     # SOL withdrawal flow (step 2: review & confirm)
    api/
      auth/[...all]/route.ts  # Better Auth catch-all handler
  lib/
    auth.ts                   # Better Auth server instance
    auth-client.ts            # Better Auth client instance
    db/
      index.ts                # Drizzle client (Neon connection)
      schema.ts               # Drizzle schema (users, wallets, addresses, etc.)
      migrations/             # Generated migration files
    solana/
      keypair.ts              # Keypair generation + AES-256-GCM encrypt/decrypt
      balance.ts              # SOL balance fetching via Helius
      transfer.ts             # SOL transfer transaction building + signing
      price.ts                # SOL/USD price fetching (CoinGecko)
  components/
    auth/
      auth-form.tsx           # Unified email-first auth form
      oauth-buttons.tsx       # Google + Twitter OAuth buttons
    wallet/
      wallet-widget.tsx       # Sidebar wallet widget
      address-display.tsx     # Togglable wallet address
      balance-display.tsx     # USD primary, SOL secondary
    two-factor/
      setup-dialog.tsx        # TOTP setup with QR code
      verify-form.tsx         # TOTP code input
      backup-codes.tsx        # Recovery codes display + acknowledge
    withdraw/
      withdraw-form.tsx       # Address + amount input
      address-book.tsx        # Saved addresses selector
      review-card.tsx         # Confirmation details card
proxy.ts                      # Next.js 16 proxy (replaces middleware.ts)
drizzle.config.ts             # Drizzle Kit configuration
```

### Pattern 1: Better Auth with Drizzle Adapter + Next.js 16
**What:** Configure Better Auth server instance with Drizzle adapter, nextCookies plugin, twoFactor plugin, and social providers.
**When to use:** Server-side auth instance, used in route handler and server components.
**Example:**
```typescript
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";

export const auth = betterAuth({
  appName: "Baremint",
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
    },
  },
  plugins: [
    twoFactor({
      issuer: "Baremint",
      totpOptions: {
        digits: 6,
        period: 30,
      },
      backupCodeOptions: {
        amount: 10,
        length: 10,
      },
    }),
    nextCookies(), // MUST be last plugin
  ],
});
```

### Pattern 2: Better Auth Client with 2FA Redirect
**What:** Client-side auth instance with twoFactor plugin for handling 2FA flows.
**Example:**
```typescript
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/auth/2fa";
      },
    }),
  ],
});
```

### Pattern 3: Next.js 16 Proxy for Route Protection
**What:** Use proxy.ts (not middleware.ts -- deprecated in Next.js 16) for session-based route protection.
**Example:**
```typescript
// proxy.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/withdraw/:path*"],
};
```

### Pattern 4: AES-256-GCM Encryption for Private Keys
**What:** Encrypt Solana keypair private keys before database storage using Node.js native crypto.
**Example:**
```typescript
// src/lib/solana/keypair.ts
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV for GCM (NOT 16)
const TAG_LENGTH = 16;

export function encryptPrivateKey(
  privateKeyBytes: Uint8Array,
  encryptionKey: Buffer
): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(privateKeyBytes),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Store as: iv:authTag:encrypted (all base64)
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptPrivateKey(
  encryptedString: string,
  encryptionKey: Buffer
): Uint8Array {
  const [ivB64, tagB64, dataB64] = encryptedString.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return new Uint8Array(decrypted);
}
```

### Pattern 5: Drizzle + Neon Connection
**What:** Set up Drizzle ORM with Neon serverless driver.
**Example:**
```typescript
// src/lib/db/index.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema });
```

### Pattern 6: SOL Transfer with @solana/kit
**What:** Build and sign a SOL transfer transaction using the new @solana/kit functional API.
**Example:**
```typescript
// src/lib/solana/transfer.ts
import {
  createSolanaRpc,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  signTransactionMessageWithSigners,
  getTransferSolInstruction,
  lamports,
  address,
} from "@solana/kit";

export async function buildSolTransfer(
  fromKeypairSigner: KeyPairSigner,
  toAddress: string,
  amountLamports: bigint,
  rpc: ReturnType<typeof createSolanaRpc>
) {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const transferInstruction = getTransferSolInstruction({
    source: fromKeypairSigner,
    destination: address(toAddress),
    amount: lamports(amountLamports),
  });

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(fromKeypairSigner.address, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstruction(transferInstruction, tx)
  );

  return signTransactionMessageWithSigners(transactionMessage);
}
```

### Anti-Patterns to Avoid
- **Using @solana/web3.js v1 Keypair class:** Use @solana/kit's `generateKeyPairSigner()` and `KeyPairSigner` instead. The old `Keypair` class is legacy.
- **Static IV for AES-GCM:** NEVER reuse IVs. Generate a random 12-byte IV per encryption call.
- **Storing encryption key in database:** The AES-256 encryption key must be in an environment variable or secret manager, never alongside the encrypted data.
- **Using middleware.ts:** Next.js 16 renamed middleware to proxy. Use `proxy.ts` with `export function proxy()`.
- **Drizzle ORM v1.0 beta with Better Auth:** Better Auth's Drizzle adapter has a known compatibility issue with drizzle-orm v1.0. Stay on stable (0.45.x).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth session management | Custom JWT/cookie handling | Better Auth sessions | Session rotation, CSRF protection, secure cookie flags are complex to get right |
| TOTP implementation | Custom TOTP generation/verification | Better Auth twoFactor plugin | RFC 6238 compliance, backup codes, time-drift tolerance all built in |
| OAuth flow | Custom OAuth state/callback handling | Better Auth socialProviders | Token exchange, PKCE, nonce handling have security-critical edge cases |
| Password hashing | Custom bcrypt/argon2 setup | Better Auth built-in | Automatic salt generation, configurable rounds, timing-safe comparison |
| Database migrations | Raw SQL migration scripts | Drizzle Kit | Schema diffing, rollback tracking, type-safe migrations |
| SOL/USD price | Custom price scraping | CoinGecko `/simple/price` API | Rate-limited, cached, reliable, free tier sufficient |
| QR code rendering | Canvas-based QR generation | `qrcode` npm package | Edge cases with error correction, padding, encoding |

**Key insight:** Better Auth's plugin system means TOTP 2FA, OAuth, and session management are all handled by the same framework with consistent patterns. Don't mix auth providers or roll custom solutions for any of these.

## Common Pitfalls

### Pitfall 1: Better Auth Cookie Handling in Server Actions
**What goes wrong:** Calling `auth.api.signInEmail()` from a Server Action doesn't set cookies because Server Actions can't set response headers directly.
**Why it happens:** Next.js Server Actions operate differently from route handlers.
**How to avoid:** Add `nextCookies()` as the LAST plugin in the Better Auth config. This automatically uses Next.js `cookies()` helper.
**Warning signs:** Login succeeds but user is not authenticated on next navigation.

### Pitfall 2: AES-256-GCM IV Reuse
**What goes wrong:** Reusing the same IV (initialization vector) with the same key completely breaks GCM security -- attackers can recover plaintext.
**Why it happens:** Developers use a static IV or derive it deterministically.
**How to avoid:** Generate a fresh 12-byte random IV (`crypto.randomBytes(12)`) for EVERY encryption call. Store the IV alongside the ciphertext.
**Warning signs:** Any code path where IV is not `randomBytes()`.

### Pitfall 3: Encryption Key in Code or Database
**What goes wrong:** The AES-256 encryption key is stored in the same database as the encrypted private keys, making the encryption pointless if the DB is compromised.
**Why it happens:** Developer puts the key in a config table for convenience.
**How to avoid:** Store the encryption key in `WALLET_ENCRYPTION_KEY` environment variable. In production, use a secret manager (AWS Secrets Manager, Vercel env vars, etc.).
**Warning signs:** Any reference to the encryption key in database schema or seed files.

### Pitfall 4: @solana/kit CryptoKeyPair vs Raw Bytes
**What goes wrong:** @solana/kit v3 uses Web Crypto API `CryptoKeyPair` objects, which don't directly expose raw private key bytes for encryption/storage.
**Why it happens:** @solana/kit moved to Web Crypto for security, making private keys non-extractable by default.
**How to avoid:** When generating keypairs for custodial storage, you need to generate raw Ed25519 key bytes manually (using `crypto.generateKeyPairSync('ed25519')` or `@solana/keys`), encrypt them, and reconstruct `KeyPairSigner` objects from bytes when needed for signing.
**Warning signs:** Attempting to access `.privateKey` on a CryptoKeyPair and getting a non-exportable key.

### Pitfall 5: Better Auth 2FA Only Works with Credential Accounts
**What goes wrong:** Users who signed up via OAuth (Google/Twitter) cannot enable 2FA through the standard plugin flow because it requires password confirmation.
**Why it happens:** Better Auth's twoFactor plugin requires `password` parameter to enable 2FA.
**How to avoid:** For OAuth users, create a custom endpoint that validates the active session instead of password. Alternatively, require OAuth users to set a password before enabling 2FA (which also serves as account recovery).
**Warning signs:** OAuth users get errors when trying to enable 2FA.

### Pitfall 6: Neon Serverless Cold Starts
**What goes wrong:** First database query after idle period takes 500ms-2s due to Neon compute endpoint waking up.
**Why it happens:** Neon suspends idle compute endpoints to save resources.
**How to avoid:** Use Neon's connection pooling. For the free tier, accept the cold start. For production, configure the compute to stay awake or use connection warming.
**Warning signs:** Intermittent slow auth responses.

### Pitfall 7: SOL Balance Polling vs Caching
**What goes wrong:** Fetching balance on every page load creates excessive RPC calls, hitting Helius rate limits.
**Why it happens:** No caching strategy for balance data.
**How to avoid:** Cache balance with a short TTL (15-30 seconds). Use React's `use` or SWR/React Query for client-side caching with background revalidation. Consider Helius webhooks for real-time balance updates in later phases.
**Warning signs:** Helius 429 rate limit errors.

## Code Examples

### Database Schema (Drizzle)
```typescript
// src/lib/db/schema.ts
import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

// Better Auth tables (generated by CLI, shown for reference)
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  secret: text("secret"),
  backupCodes: text("backup_codes"),
});

// Custom tables for Baremint
export const wallet = pgTable("wallet", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id).unique(),
  publicKey: text("public_key").notNull().unique(),
  encryptedPrivateKey: text("encrypted_private_key").notNull(), // AES-256-GCM encrypted
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const savedAddress = pgTable("saved_address", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  address: text("address").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const withdrawal = pgTable("withdrawal", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  amountLamports: text("amount_lamports").notNull(), // Store as text to avoid BigInt issues
  networkFeeLamports: text("network_fee_lamports"),
  txSignature: text("tx_signature"),
  status: text("status").notNull().default("pending"), // pending, confirmed, failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});
```

### SOL Balance Fetching
```typescript
// src/lib/solana/balance.ts
import { createSolanaRpc, address, lamports } from "@solana/kit";

const rpc = createSolanaRpc(process.env.HELIUS_RPC_URL!);

export async function getSolBalance(publicKey: string): Promise<bigint> {
  const { value } = await rpc.getBalance(address(publicKey)).send();
  return value; // in lamports
}

export function lamportsToSol(lamportsAmount: bigint): number {
  return Number(lamportsAmount) / 1_000_000_000;
}
```

### SOL/USD Price
```typescript
// src/lib/solana/price.ts
let cachedPrice: { usd: number; timestamp: number } | null = null;
const CACHE_TTL = 60_000; // 1 minute

export async function getSolUsdPrice(): Promise<number> {
  if (cachedPrice && Date.now() - cachedPrice.timestamp < CACHE_TTL) {
    return cachedPrice.usd;
  }
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
  );
  const data = await res.json();
  cachedPrice = { usd: data.solana.usd, timestamp: Date.now() };
  return cachedPrice.usd;
}
```

### Route Handler for Better Auth
```typescript
// src/app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### Server-Side Session Check
```typescript
// In any server component or server action
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getServerSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @solana/web3.js v1 `Keypair` class | @solana/kit v3 `KeyPairSigner` + `generateKeyPairSigner()` | 2025 | Functional API, tree-shakeable, Web Crypto based |
| next-auth / auth.js | better-auth gaining traction | 2024-2025 | Plugin-based, TypeScript-first, simpler DX |
| middleware.ts in Next.js | proxy.ts in Next.js 16 | 2025 (Next.js 16) | `middleware` deprecated, renamed to `proxy` |
| @solana/web3.js `Connection` | @solana/kit `createSolanaRpc()` | 2025 | Factory-based RPC with `.send()` pattern |
| helius-sdk v1 (web3.js v1) | helius-sdk v2 (@solana/kit) | 2025 | Complete rewrite using @solana/kit under the hood |

**Deprecated/outdated:**
- `middleware.ts` -- renamed to `proxy.ts` in Next.js 16
- `@solana/web3.js` v1 -- replaced by `@solana/kit` v3
- `Keypair.generate()` -- replaced by `generateKeyPairSigner()`
- `Connection` class -- replaced by `createSolanaRpc()` factory

## Open Questions

1. **@solana/kit CryptoKeyPair exportability for custodial storage**
   - What we know: @solana/kit uses Web Crypto API which defaults to non-extractable keys
   - What's unclear: The exact API to generate exportable keypairs for server-side custodial use
   - Recommendation: During implementation, test with `@solana/keys` package's `createKeyPairFromBytes()` for reconstructing signers from stored bytes. May need to use Node.js `crypto.generateKeyPairSync('ed25519')` for the initial generation, then convert to @solana/kit types.

2. **Better Auth 2FA for OAuth-only users**
   - What we know: The twoFactor plugin requires password to enable. OAuth users don't have passwords.
   - What's unclear: Best UX for requiring 2FA before withdrawal when user signed up via OAuth
   - Recommendation: Require OAuth users to set a password (via account linking) before enabling 2FA. This also gives them a recovery path. Better Auth supports account linking natively.

3. **Helius free tier rate limits for balance polling**
   - What we know: Helius free tier has limits, exact current limits not verified
   - What's unclear: Whether free tier is sufficient for development + early users
   - Recommendation: Implement caching from day one. Check Helius pricing dashboard during development.

## Sources

### Primary (HIGH confidence)
- [Better Auth Next.js integration docs](https://www.better-auth.com/docs/integrations/next) - Route handler, proxy, session management
- [Better Auth 2FA plugin docs](https://www.better-auth.com/docs/plugins/2fa) - TOTP setup, backup codes, verification flow
- [Better Auth Drizzle adapter docs](https://www.better-auth.com/docs/adapters/drizzle) - Schema generation, provider config
- [Drizzle ORM + Neon tutorial](https://orm.drizzle.team/docs/get-started/neon-new) - Connection setup, schema definition
- [Next.js 16 proxy.ts file convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) - Proxy replaces middleware
- [Helius getBalance RPC docs](https://www.helius.dev/docs/api-reference/rpc/http/getbalance) - Balance fetching
- [Node.js crypto API docs](https://nodejs.org/api/crypto.html) - AES-256-GCM implementation

### Secondary (MEDIUM confidence)
- [@solana/kit npm](https://www.npmjs.com/package/@solana/kit) - v3.0.3 confirmed, replaces web3.js v2
- [helius-sdk npm](https://www.npmjs.com/package/helius-sdk) - v2.0.5 confirmed, uses @solana/kit
- [Helius blog on web3.js 2.0](https://www.helius.dev/blog/how-to-start-building-with-the-solana-web3-js-2-0-sdk) - KeyPairSigner patterns
- [QuickNode transfer SOL guide](https://www.quicknode.com/guides/solana-development/tooling/web3-2/transfer-sol) - @solana/kit transaction pattern
- [CoinGecko API pricing](https://www.coingecko.com/en/api/pricing) - Free tier: 30 calls/min, 10k/month

### Tertiary (LOW confidence)
- [DEV.to: Adding 2FA to OAuth in Next.js 16 with Better Auth](https://dev.to/zntb/adding-2fa-to-oauth-logins-in-nextjs-16-with-better-auth-2eep) - OAuth 2FA workaround pattern
- [GitHub AES-256-GCM gist](https://gist.github.com/rjz/15baffeab434b8125ca4d783f4116d81) - Encryption pattern reference

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries verified on npm with current versions, official docs reviewed
- Architecture: HIGH - patterns derived from official documentation for all major libraries
- Pitfalls: MEDIUM - some pitfalls (especially @solana/kit CryptoKeyPair behavior) need implementation validation
- AES-256-GCM: HIGH - Node.js native crypto, well-documented standard
- SOL/USD pricing: HIGH - CoinGecko free API is straightforward and well-documented

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (30 days -- stable libraries, no major releases expected)
