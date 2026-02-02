---
phase: 06-token-trading
plan: 01
subsystem: trading-core
tags: [solana, bonding-curve, bigint, server-actions, drizzle]
dependency-graph:
  requires: [02-bonding-curve, 03-creator-onboarding]
  provides: [bonding-curve-math, account-reader, trade-builders, trade-schema, trade-actions]
  affects: [06-02, 06-03, 06-04, 06-05]
tech-stack:
  added: ["@solana-program/token"]
  patterns: [constant-product-math, pda-deserialization, pipe-transaction-builder]
key-files:
  created:
    - lib/solana/bonding-curve-math.ts
    - lib/solana/bonding-curve-read.ts
    - lib/solana/trade.ts
    - app/trade/[token]/actions.ts
  modified:
    - lib/db/schema.ts
decisions:
  - id: "06-01-01"
    decision: "All math uses BigInt (no floating point) to match on-chain Rust u64/u128 precision"
  - id: "06-01-02"
    decision: "GlobalConfig deserialized with all fields (not just fee_bps) for future use"
  - id: "06-01-03"
    decision: "Price per token stored as rational string (num/denom) to avoid precision loss"
  - id: "06-01-04"
    decision: "getQuote is unauthenticated (public pricing data), executeBuy/executeSell require auth"
metrics:
  duration: "~4.5 min"
  completed: "2026-02-02"
---

# Phase 6 Plan 1: Trading Core Infrastructure Summary

Constant-product bonding curve math ported from Rust to TypeScript with BigInt, PDA account deserialization, buy/sell transaction builders using @solana/kit pipe pattern, trade DB schema, and authenticated server actions.

## What Was Built

### Bonding Curve Math (`lib/solana/bonding-curve-math.ts`)
- `calculateBuyTokens` / `calculateSellSol`: Constant-product formula matching on-chain math exactly
- `calculateFee`: Ceiling division fee calculation (protocol-favorable)
- `estimateBuy`: Fee deducted BEFORE curve calc (matches buy.rs)
- `estimateSell`: Fee deducted AFTER curve calc (matches sell.rs)
- `calculatePricePerToken`: Spot price as rational number (avoids floats)
- All functions handle zero-input edge cases, return BigInt(0)

### Account Reader (`lib/solana/bonding-curve-read.ts`)
- `deserializeBondingCurve`: Parses 8-byte discriminator + 10 fields from raw bytes
- `readBondingCurveAccount`: Derives PDA, fetches via RPC, deserializes
- `deserializeGlobalConfig`: Parses full GlobalConfig with all 11 fields
- `readGlobalConfig`: Derives PDA, fetches via RPC, deserializes
- Uses `getAddressDecoder` for Pubkey bytes to Address conversion

### Transaction Builders (`lib/solana/trade.ts`)
- `buildAndSendBuy`: Creates ATA idempotently + buy instruction in single tx
- `buildAndSendSell`: Sell instruction with slippage protection
- Follows exact same pipe pattern as create-token.ts
- Account ordering matches Anchor IDL discriminators

### Server Actions (`app/trade/[token]/actions.ts`)
- `getQuote`: Public, validates with zod, returns stringified estimates + price impact
- `executeBuy`: Authenticated, builds/sends tx, inserts pending trade record
- `executeSell`: Authenticated, builds/sends tx, inserts pending trade record
- All BigInt values converted to string before return

### Trade Schema (`lib/db/schema.ts`)
- `trade` table with: id, userId, creatorTokenId, mintAddress, type, solAmount, tokenAmount, feeAmount, pricePerToken, txSignature (unique), status, createdAt, confirmedAt

## Decisions Made

1. **BigInt everywhere** — No floating-point math in any trading code. Matches on-chain Rust precision exactly.
2. **Full GlobalConfig deserialization** — Plan only mentioned fee_bps, but deserialized all fields for future use by other plans.
3. **Rational price storage** — Price per token stored as "num/denom" string to avoid float precision loss.
4. **Public getQuote** — No authentication needed for price quotes (read-only chain data).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] addressEncoder.decode does not exist**
- **Found during:** Task 1
- **Issue:** Plan used `getAddressEncoder().decode()` but encoder only has `encode()`. Decoder is separate.
- **Fix:** Used `getAddressDecoder()` from @solana/kit for bytes-to-Address conversion
- **Files modified:** lib/solana/bonding-curve-read.ts
- **Commit:** 2aba51e

**2. [Rule 2 - Missing Critical] GlobalConfig has more fields than plan specified**
- **Found during:** Task 1
- **Issue:** On-chain GlobalConfig has 11 fields (authority, fee_bps, platform_fee_bps, creator_fee_bps, reserves, vesting params, etc.), plan only mentioned 3
- **Fix:** Deserialized all fields to match actual on-chain struct layout
- **Files modified:** lib/solana/bonding-curve-read.ts
- **Commit:** 2aba51e

## Verification Results

- `npx tsc --noEmit` passes with zero errors
- `npx drizzle-kit push` succeeded (trade table created)
- Buy flow: fee before curve, matching buy.rs exactly
- Sell flow: fee after curve, matching sell.rs exactly
- Fee ceiling division: `(amount * bps + 9999) / 10000` matching math.rs

## Next Phase Readiness

All trading primitives are ready for:
- **06-02**: Trading UI can call `getQuote`, `executeBuy`, `executeSell`
- **06-03**: Webhooks can update trade status from pending to confirmed/failed
- **06-04**: Charts can use `calculatePricePerToken` for price display
- **06-05**: History can query trade table
