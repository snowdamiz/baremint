---
phase: 01-authentication-wallets
plan: 02
subsystem: wallet
tags: [solana, ed25519, aes-256-gcm, custodial-wallet, coingecko, helius]

dependency-graph:
  requires:
    - 01-01 (database schema with wallet table, Better Auth setup, dashboard layout)
  provides:
    - Automatic wallet creation on user signup
    - AES-256-GCM encrypted private key storage
    - SOL balance fetching via Helius RPC
    - SOL/USD price conversion via CoinGecko
    - Dashboard sidebar wallet widget
  affects:
    - 01-03 (OAuth signup will also trigger wallet creation via same hook)
    - Phase 3 (withdrawal flow needs decryptPrivateKey)
    - Phase 5 (token purchases need wallet address)

tech-stack:
  added: []
  patterns:
    - Node.js crypto for Ed25519 keypair generation (not Web Crypto)
    - DER format extraction for raw 32-byte key bytes
    - AES-256-GCM with random 12-byte IV per encryption
    - Module-level in-memory cache for price data
    - Better Auth databaseHooks for post-signup automation

key-files:
  created:
    - lib/solana/keypair.ts
    - lib/solana/balance.ts
    - lib/solana/price.ts
    - lib/solana/get-wallet-data.ts
    - components/wallet/wallet-widget.tsx
    - components/wallet/address-display.tsx
    - components/wallet/balance-display.tsx
  modified:
    - lib/auth.ts
    - app/(dashboard)/layout.tsx
    - app/(dashboard)/dashboard/page.tsx

decisions:
  - Used Node.js crypto.generateKeyPairSync('ed25519') instead of @solana/kit generateKeyPairSigner (Web Crypto keys are non-extractable)
  - Used getBase58Decoder from @solana/kit for public key to address conversion
  - Wallet creation failure logged but does not block user signup (try/catch with console.error)
  - Dashboard layout handles auth check and wallet data fetching (shared across dashboard pages)
  - Mobile responsive: wallet widget renders above content on small screens instead of sidebar

metrics:
  duration: ~3 minutes
  completed: 2026-01-31
---

# Phase 01 Plan 02: Custodial Wallet Summary

Ed25519 keypair auto-generated on signup with AES-256-GCM encrypted storage; dashboard sidebar widget shows USD/SOL balance with hidden address toggle.

## Tasks Completed

### Task 1: Keypair generation, encryption, and wallet creation on signup
**Commit:** cf9ef58

Created `lib/solana/keypair.ts` with four exported functions:
- `generateWalletKeypair()` -- generates Ed25519 keypair via Node.js crypto, extracts raw 32-byte keys from DER encoding, converts public key to base58 Solana address
- `encryptPrivateKey()` -- AES-256-GCM encryption with random 12-byte IV, returns "iv:authTag:ciphertext" format
- `decryptPrivateKey()` -- reverses encryption, returns raw Uint8Array
- `getEncryptionKey()` -- loads 64-char hex string from WALLET_ENCRYPTION_KEY env var

Updated `lib/auth.ts` with `databaseHooks.user.create.after` that automatically creates a wallet row with encrypted private key for every new user signup.

### Task 2: Wallet widget with balance display on dashboard
**Commit:** 1fb2e4c

Created the full wallet data pipeline:
- `lib/solana/balance.ts` -- SOL balance via @solana/kit createSolanaRpc (Helius or devnet fallback)
- `lib/solana/price.ts` -- CoinGecko SOL/USD price with 60-second in-memory cache
- `lib/solana/get-wallet-data.ts` -- aggregates wallet address, SOL balance, and USD value

Created wallet UI components:
- `AddressDisplay` -- client component with show/hide toggle and copy-to-clipboard
- `BalanceDisplay` -- USD primary ($0.00 format), SOL secondary, empty state message
- `WalletWidget` -- card combining balance and address displays

Updated dashboard layout to fetch wallet data server-side and render the widget in the sidebar (desktop) or above content (mobile).

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Node.js crypto for keypair (not Web Crypto) | Web Crypto Ed25519 keys via @solana/kit are non-extractable -- cannot encrypt for storage |
| Wallet creation wrapped in try/catch | Prevents wallet failure from blocking user signup; can be retried later |
| Auth check in both layout and page | Layout needs session for wallet data; page keeps its own check for safety |
| BigInt(0) instead of 0n literal | Target ES2017 in tsconfig does not support BigInt literals |

## Next Phase Readiness

Plan 01-03 (OAuth/2FA) can proceed -- the databaseHooks wallet creation will fire for OAuth signups too since Better Auth triggers the same user.create hook regardless of auth method.

Phase 3 (withdrawals) has everything it needs: `decryptPrivateKey()` is ready, wallet table stores encrypted keys.
