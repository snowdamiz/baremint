# Phase 6: Token Trading - Research

**Researched:** 2026-02-01
**Domain:** Solana bonding curve trading UI, transaction construction, real-time confirmation, price charting
**Confidence:** HIGH

## Summary

Phase 6 implements the complete token trading experience: buy/sell server actions that construct and submit Solana transactions against the existing on-chain bonding curve program, a trading UI with amount inputs and fee breakdowns, Helius webhooks for transaction confirmation and off-chain ledger sync, candlestick price charts, and user transaction history.

The on-chain program (buy/sell instructions) already exists and is tested. The Anchor IDL provides discriminators and account layouts. The project already uses `@solana/kit` v5.5+ with the pipe-based transaction builder pattern (see `lib/solana/create-token.ts` and `lib/solana/transfer.ts`). The same pattern extends directly to buy/sell instructions -- the main work is instruction data encoding, PDA derivation, ATA creation, and server-side price estimation (replicating the constant-product math in TypeScript).

**Primary recommendation:** Follow the existing `@solana/kit` pipe pattern for transaction construction, use `helius-sdk` v2.1 for webhook management, TradingView Lightweight Charts v5.1 for candlestick charts (client-only with dynamic import), and a new `trade` DB table as the off-chain ledger for transaction history and OHLCV aggregation.

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@solana/kit` | 5.5.1 | Transaction construction, PDA derivation, signing | Already in project, pipe-based functional API |
| `helius-sdk` | 2.1.0 | Webhook management, enhanced transaction parsing | Already in project, webhook creation API |
| `sonner` | 2.0.7 | Toast notifications for trade feedback | Already in project, used throughout |
| `drizzle-orm` | 0.45.1 | Off-chain trade ledger, OHLCV aggregation queries | Already in project |
| `zod` | 4.3.6 | Server action input validation | Already in project |

### New Dependencies
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lightweight-charts` | 5.1.0 | Candlestick + line charts (TradingView) | Price chart on trade page |
| `@solana-program/token` | (latest) | `findAssociatedTokenPda`, `getCreateAssociatedTokenIdempotentInstructionAsync` | ATA creation before buy instruction |
| `@solana-program/system` | (latest) | `getTransferSolInstruction` (already used in transfer.ts) | Already a dependency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `lightweight-charts` | `recharts` or `Chart.js` | No built-in candlestick support; lightweight-charts is purpose-built for financial data at 45KB |
| Manual Anchor instruction encoding | `@coral-xyz/anchor` client | Anchor client pulls in heavy dependencies; project already uses manual encoding pattern in `create-token.ts` |
| Helius webhooks | Polling `getSignatureStatuses` | Polling is wasteful and slow; webhooks are push-based and already have SDK support |

**Installation:**
```bash
npm install lightweight-charts @solana-program/token
```

Note: `@solana-program/system` is already installed (used in `lib/solana/transfer.ts`).

## Architecture Patterns

### Recommended Project Structure
```
lib/solana/
├── trade.ts              # buildAndSendBuy(), buildAndSendSell() - server-side
├── bonding-curve-math.ts # TypeScript port of on-chain constant-product math
├── bonding-curve-read.ts # Read & deserialize BondingCurve PDA account data
├── create-token.ts       # (existing)
├── transfer.ts           # (existing)
├── token-balance.ts      # (existing)
├── balance.ts            # (existing)
├── price.ts              # (existing)
└── keypair.ts            # (existing)

app/trade/[token]/
├── page.tsx              # Trade page (server component: loads token + curve data)
├── trade-form.tsx        # Buy/sell tabs, amount input, fee preview (client)
├── price-chart.tsx       # Lightweight Charts candlestick (client, dynamic import)
├── curve-viz.tsx         # Bonding curve visualization (client, collapsible)
├── trade-history.tsx     # User's trade history tab (client)
└── actions.ts            # Server actions: executeBuy, executeSell, getTradeHistory

app/api/webhooks/helius/
└── route.ts              # Helius webhook receiver for trade confirmation

lib/db/schema.ts          # Add `trade` table
```

### Pattern 1: Transaction Construction (Buy)
**What:** Build a buy instruction following the existing `create-token.ts` manual encoding pattern
**When to use:** Every buy trade execution
**Example:**
```typescript
// Source: Existing pattern in lib/solana/create-token.ts + Anchor IDL
const BUY_DISCRIMINATOR = new Uint8Array([102, 6, 61, 18, 1, 218, 235, 234]);

function buildBuyInstructionData(solAmount: bigint, minTokensOut: bigint): Uint8Array {
  const u64Encoder = getU64Encoder();
  const data = new Uint8Array(8 + 8 + 8); // discriminator + sol_amount + min_tokens_out
  data.set(BUY_DISCRIMINATOR, 0);
  data.set(new Uint8Array(u64Encoder.encode(solAmount)), 8);
  data.set(new Uint8Array(u64Encoder.encode(minTokensOut)), 16);
  return data;
}
```

### Pattern 2: ATA Creation Before Buy
**What:** Buyer must have an ATA for the token mint before the buy instruction runs
**When to use:** Every buy transaction (idempotent create won't fail if ATA exists)
**Example:**
```typescript
// Source: @solana-program/token docs
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync } from "@solana-program/token";

const [buyerAta] = await findAssociatedTokenPda({
  mint: mintAddress,
  owner: buyerAddress,
  tokenProgram: TOKEN_PROGRAM_ADDRESS,
});

const createAtaIx = getCreateAssociatedTokenIdempotentInstructionAsync({
  payer: buyerSigner,
  mint: mintAddress,
  owner: buyerAddress,
});

// Prepend to transaction: createATA + buy instruction in same tx
```

### Pattern 3: Server-Side Price Estimation
**What:** Replicate the on-chain constant-product math in TypeScript to show estimated output before signing
**When to use:** Every trade preview / fee breakdown calculation
**Example:**
```typescript
// Source: programs/baremint/src/math.rs (ported to TypeScript)
function calculateBuyTokens(
  virtualSolReserves: bigint,
  virtualTokenReserves: bigint,
  solAmount: bigint,
): bigint {
  if (solAmount === 0n) return 0n;
  const k = virtualSolReserves * virtualTokenReserves;
  const newVirtualSol = virtualSolReserves + solAmount;
  const newVirtualToken = k / newVirtualSol;
  return virtualTokenReserves - newVirtualToken; // floor division = protocol-favorable
}

function calculateFee(amount: bigint, feeBps: number): bigint {
  if (amount === 0n || feeBps === 0) return 0n;
  return (amount * BigInt(feeBps) + 9999n) / 10000n; // ceiling division
}
```

### Pattern 4: BondingCurve Account Deserialization
**What:** Read the BondingCurve PDA account data to get current reserves for price estimation
**When to use:** Before displaying trade preview, building price chart data
**Example:**
```typescript
// Source: Anchor IDL + Borsh layout from bonding_curve.rs
// BondingCurve account: 8-byte discriminator + fields
// Fields (in order): token_mint(32) + creator(32) + virtual_token_reserves(8) +
//   virtual_sol_reserves(8) + real_token_reserves(8) + real_sol_reserves(8) +
//   token_total_supply(8) + burn_sol_price(8) + platform_fees_accrued(8) +
//   creator_fees_accrued(8) + bump(1)
// Total: 8 + 32 + 32 + 8*8 + 1 = 137 bytes

function deserializeBondingCurve(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset);
  let offset = 8; // skip discriminator
  // Read pubkeys and u64s in order...
  const virtualTokenReserves = view.getBigUint64(offset + 64, true); // LE
  const virtualSolReserves = view.getBigUint64(offset + 72, true);
  // ... etc
}
```

### Pattern 5: Lightweight Charts with Next.js (Client-Only)
**What:** TradingView Lightweight Charts is browser-only; must use dynamic import in Next.js
**When to use:** Price chart component
**Example:**
```typescript
// Source: lightweight-charts docs + Next.js dynamic import pattern
"use client";
import dynamic from "next/dynamic";

const PriceChart = dynamic(() => import("./price-chart-inner"), { ssr: false });

// In price-chart-inner.tsx:
import { createChart, CandlestickSeries } from "lightweight-charts";
// Use useRef + useEffect pattern to create chart in browser
```

### Pattern 6: Helius Webhook for Trade Confirmation
**What:** Register a webhook to monitor the bonding curve PDA for buy/sell transactions
**When to use:** Set up once per deployed token; receives push notifications on trades
**Example:**
```typescript
// Source: helius-sdk README
import { Helius } from "helius-sdk";

const helius = new Helius(process.env.HELIUS_API_KEY!);
await helius.webhooks.createWebhook({
  accountAddresses: [bondingCurveAddress],
  transactionTypes: ["ANY"],
  webhookURL: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/helius`,
  webhookType: "raw", // Use raw for lower latency; parse ourselves
});
```

### Anti-Patterns to Avoid
- **Client-side private key handling:** Never send private keys to the browser. All transaction signing happens server-side in Next.js server actions.
- **Polling for confirmation:** Use Helius webhooks instead of polling `getSignatureStatuses`.
- **Floating-point math for token amounts:** Always use BigInt for lamport/token calculations. The existing codebase correctly uses BigInt throughout.
- **Importing lightweight-charts at module level:** Will crash SSR. Must use dynamic import or `"use client"` with lazy loading.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Candlestick charting | Custom canvas chart | `lightweight-charts` v5.1 | Financial charts are complex (zoom, crosshair, responsive, time axis); TradingView's lib handles all this at 45KB |
| ATA creation | Manual instruction bytes | `@solana-program/token` `getCreateAssociatedTokenIdempotentInstructionAsync` | ATA derivation + creation has edge cases (idempotent check, rent calculation) |
| Bonding curve math | Approximate floating-point | Port exact u128 integer math from Rust | Must match on-chain calculation exactly for accurate slippage estimation |
| Transaction confirmation | Polling loop | Helius webhooks | Push vs poll; webhooks are reliable, handle retries, and provide parsed data |
| Toast notifications | Custom notification system | `sonner` (already installed) | Already used throughout the app |

**Key insight:** The on-chain math uses u128 intermediate values with floor/ceiling division. JavaScript BigInt natively supports arbitrary precision, so the port is straightforward -- but you must replicate the exact rounding behavior (floor for buys, ceiling for fees) or price estimates will mismatch.

## Common Pitfalls

### Pitfall 1: ATA Must Exist Before Buy Instruction
**What goes wrong:** Buy instruction fails with "Account not found" if buyer doesn't have an ATA for the token mint
**Why it happens:** The on-chain program expects `buyer_token_account` to already exist (it's not marked with `init`)
**How to avoid:** Always prepend `createAssociatedTokenIdempotent` instruction in the same transaction as buy. The idempotent variant won't fail if ATA already exists.
**Warning signs:** Transaction simulation fails with account-not-found errors on devnet

### Pitfall 2: Fee Deduction Timing Asymmetry
**What goes wrong:** Client-side estimates don't match on-chain execution because fees are deducted differently for buy vs sell
**Why it happens:** Buy: fee deducted BEFORE curve calculation (from SOL input). Sell: fee deducted AFTER curve calculation (from SOL output).
**How to avoid:** The TypeScript math module must implement both flows exactly:
- Buy: `solIntoCurve = solAmount - fee(solAmount)` then `tokensOut = calcBuy(solIntoCurve)`
- Sell: `grossSol = calcSell(tokenAmount)` then `netSol = grossSol - fee(grossSol)`
**Warning signs:** Displayed estimates differ from actual executed amounts

### Pitfall 3: Slippage Parameter Must Account for Fee Timing
**What goes wrong:** User sets 1% slippage but gets slippage-exceeded errors
**Why it happens:** `min_tokens_out` (buy) / `min_sol_out` (sell) must be calculated AFTER fees, with slippage applied to the net amount
**How to avoid:** Calculate `minTokensOut = estimatedTokens * (1 - slippageBps/10000)`, where `estimatedTokens` is already the post-fee amount
**Warning signs:** Trades fail with SlippageExceeded (error code 6002) when market is volatile

### Pitfall 4: Lightweight Charts SSR Crash
**What goes wrong:** Next.js build fails or hydration errors
**Why it happens:** lightweight-charts accesses `document` and `window` at import time
**How to avoid:** Use `dynamic(() => import("./chart"), { ssr: false })` or ensure the component is only rendered client-side
**Warning signs:** "document is not defined" or "window is not defined" errors during build

### Pitfall 5: BigInt Serialization in Server Actions
**What goes wrong:** Server action returns `{ amount: 1000000000n }` but client receives error
**Why it happens:** BigInt is not JSON-serializable. Next.js server actions use JSON serialization.
**How to avoid:** Always convert BigInt to string before returning from server actions, and parse back with `BigInt()` on the client. The existing codebase already uses this pattern (see `amountLamports: text()` in schema).
**Warning signs:** "Do not know how to serialize a BigInt" runtime errors

### Pitfall 6: Helius Webhook Idempotency
**What goes wrong:** Duplicate trade records in database
**Why it happens:** Helius may retry webhook delivery; you may receive the same event multiple times
**How to avoid:** Use the transaction signature as a unique key. Upsert with `onConflictDoNothing` or check for existence before insert.
**Warning signs:** Duplicate entries in trade table with same `txSignature`

### Pitfall 7: Bonding Curve Reserves Stale Read
**What goes wrong:** Price estimate shown to user doesn't match execution price
**Why it happens:** Between reading reserves and submitting the transaction, another user may have traded
**How to avoid:** Apply slippage tolerance. Show a clear "estimated" label on previews. The `min_tokens_out` / `min_sol_out` parameter protects against excessive slippage on-chain.
**Warning signs:** Users report "estimated X but received Y" discrepancies

### Pitfall 8: Integer Rounding in Constant-Product Math
**What goes wrong:** Client-side estimate is off by 1 lamport/token
**Why it happens:** JavaScript BigInt division truncates (floors), which matches the Rust behavior for buys. But fee calculation uses ceiling division which needs explicit implementation.
**How to avoid:** Implement ceiling division as `(amount * bps + 9999n) / 10000n` exactly matching the Rust math.
**Warning signs:** Simulation passes but on-chain execution differs by exactly 1 unit

## Code Examples

### Complete Buy Transaction Construction
```typescript
// Source: Pattern from lib/solana/create-token.ts adapted for buy instruction
import {
  createSolanaRpc,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  createKeyPairSignerFromBytes,
  getBase64EncodedWireTransaction,
  getAddressEncoder,
  getProgramDerivedAddress,
  getU64Encoder,
  AccountRole,
  address,
} from "@solana/kit";
import type { Address, Instruction } from "@solana/kit";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";

const BUY_DISCRIMINATOR = new Uint8Array([102, 6, 61, 18, 1, 218, 235, 234]);
const SELL_DISCRIMINATOR = new Uint8Array([51, 230, 133, 164, 1, 127, 131, 173]);
const PROGRAM_ID: Address = "FTAssMPiQ8EQUeJA4Rnu6c71maCrUCdnvGetWnVdTXTG" as Address;

// PDA derivation for buy/sell (same pattern as create-token.ts)
async function deriveTradePDAs(mintAddress: Address) {
  const addressEncoder = getAddressEncoder();
  const mintBytes = addressEncoder.encode(mintAddress);

  const [globalConfig] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["global_config"],
  });
  const [bondingCurve] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["bonding_curve", mintBytes],
  });
  const [curveTokenAccount] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["curve_tokens", mintBytes],
  });
  return { globalConfig, bondingCurve, curveTokenAccount };
}
```

### Bonding Curve Math (TypeScript Port)
```typescript
// Source: programs/baremint/src/math.rs - exact port
export function calculateBuyTokens(
  virtualSolReserves: bigint,
  virtualTokenReserves: bigint,
  solAmount: bigint,
): bigint {
  if (solAmount === 0n) return 0n;
  const k = virtualSolReserves * virtualTokenReserves;
  const newVirtualSol = virtualSolReserves + solAmount;
  const newVirtualToken = k / newVirtualSol; // BigInt division = floor
  return virtualTokenReserves - newVirtualToken;
}

export function calculateSellSol(
  virtualSolReserves: bigint,
  virtualTokenReserves: bigint,
  tokenAmount: bigint,
): bigint {
  if (tokenAmount === 0n) return 0n;
  const k = virtualSolReserves * virtualTokenReserves;
  const newVirtualToken = virtualTokenReserves + tokenAmount;
  const newVirtualSol = k / newVirtualToken; // BigInt division = floor
  return virtualSolReserves - newVirtualSol;
}

export function calculateFee(amount: bigint, feeBps: number): bigint {
  if (amount === 0n || feeBps === 0) return 0n;
  // Ceiling division: (amount * bps + 9999) / 10000
  return (amount * BigInt(feeBps) + 9999n) / 10000n;
}

// Full buy estimate (mirrors on-chain flow)
export function estimateBuy(solAmount: bigint, feeBps: number, virtualSol: bigint, virtualToken: bigint) {
  const totalFee = calculateFee(solAmount, feeBps);
  const platformFee = totalFee / 2n;
  const creatorFee = totalFee - platformFee;
  const solIntoCurve = solAmount - totalFee;
  const tokensOut = calculateBuyTokens(virtualSol, virtualToken, solIntoCurve);
  return { tokensOut, totalFee, platformFee, creatorFee, solIntoCurve };
}

// Full sell estimate (mirrors on-chain flow)
export function estimateSell(tokenAmount: bigint, feeBps: number, virtualSol: bigint, virtualToken: bigint) {
  const grossSol = calculateSellSol(virtualSol, virtualToken, tokenAmount);
  const totalFee = calculateFee(grossSol, feeBps);
  const platformFee = totalFee / 2n;
  const creatorFee = totalFee - platformFee;
  const netSol = grossSol - totalFee;
  return { netSol, grossSol, totalFee, platformFee, creatorFee };
}
```

### Trade DB Schema
```typescript
// Off-chain trade ledger for history + OHLCV aggregation
export const trade = pgTable("trade", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  creatorTokenId: text("creator_token_id").notNull().references(() => creatorToken.id),
  mintAddress: text("mint_address").notNull(),
  type: text("type").notNull(), // "buy" | "sell"
  solAmount: text("sol_amount").notNull(), // lamports as string
  tokenAmount: text("token_amount").notNull(), // raw token amount as string
  feeAmount: text("fee_amount").notNull(), // total fee in lamports
  pricePerToken: text("price_per_token"), // SOL per token at time of trade
  txSignature: text("tx_signature").notNull().unique(),
  status: text("status").notNull().default("pending"), // pending | confirmed | failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});
```

### Helius Webhook Handler
```typescript
// Source: Helius webhook docs + existing webhook patterns (mux/route.ts)
// POST /api/webhooks/helius
export async function POST(request: Request) {
  const body = await request.json();
  // body is array of raw transactions
  for (const tx of body) {
    const signature = tx.transaction?.signatures?.[0];
    if (!signature) continue;

    // Check if we have a pending trade with this signature
    // Update status to "confirmed" + extract on-chain data
    // Upsert with onConflictDoNothing for idempotency
  }
  return new Response("OK", { status: 200 });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@solana/web3.js` 1.x imperative API | `@solana/kit` 5.x pipe-based functional API | 2025 | Project already uses new API; all new code should follow pipe pattern |
| `chart.addCandlestickSeries()` | `chart.addSeries(CandlestickSeries, opts)` | lightweight-charts v5 | Must use v5 API, not v4 examples from older tutorials |
| Helius SDK 1.x | Helius SDK 2.x (uses @solana/kit internally) | Jan 2026 | v2.x is rewritten; webhook API surface similar but imports differ |
| Anchor TypeScript client for instruction building | Manual instruction encoding with @solana/kit | Project choice | Avoids heavy Anchor dependency in frontend; consistent with create-token.ts pattern |

**Deprecated/outdated:**
- `@solana/web3.js` v1.x: Project uses `@solana/kit` (v2.x rebranding); do not introduce old API
- `lightweight-charts` v3/v4 API (`addCandlestickSeries`): Must use v5 `addSeries(CandlestickSeries)` pattern

## Open Questions

1. **OHLCV Data Aggregation Strategy**
   - What we know: Trades are recorded in the `trade` table with timestamps and prices
   - What's unclear: Whether to aggregate OHLCV on-the-fly via SQL queries or pre-compute in a separate table. For MVP with low volume, on-the-fly SQL is simpler.
   - Recommendation: Use SQL aggregation at query time for MVP. Add materialized OHLCV table if performance becomes an issue.

2. **Helius Webhook Setup Timing**
   - What we know: Webhooks need the bonding curve PDA address to monitor
   - What's unclear: Whether to register webhooks at token creation time (automated) or manually via dashboard
   - Recommendation: Register programmatically at token creation time (extend the create-token flow). Store webhook ID in the `creatorToken` table for management.

3. **HELIUS_API_KEY vs HELIUS_RPC_URL**
   - What we know: The project uses `HELIUS_RPC_URL` for RPC calls. Helius SDK `createWebhook` needs an API key.
   - What's unclear: Whether the existing `HELIUS_RPC_URL` includes the API key as a query param, or if a separate `HELIUS_API_KEY` env var is needed.
   - Recommendation: Add `HELIUS_API_KEY` as a separate env var for webhook management. The RPC URL typically includes the key in the path but SDK methods need it separately.

4. **Price Chart Initial Data**
   - What we know: New tokens start with zero trade history
   - What's unclear: How to show a meaningful chart for tokens with very few trades
   - Recommendation: Show a simple price line derived from bonding curve reserves when trade history is sparse. Switch to candlestick when sufficient data (e.g., 10+ trades across multiple time periods).

## Claude's Discretion Recommendations

Based on the research, here are recommendations for the items left to Claude's discretion:

### Quick-Amount Buttons
**Recommendation:** Percentage-based buttons (25%, 50%, 75%, MAX) for both buy and sell.
- Buy: percentages of the user's SOL balance
- Sell: percentages of the user's token balance
- This is the standard pattern on DEX interfaces (Uniswap, Jupiter, pump.fun)

### Fee Breakdown Display
**Recommendation:** Always visible below the amount input, in a compact format:
- Show: Platform fee | Creator fee | Total fee | Net amount
- Use muted text at small size; no expandable/collapsible needed
- This matches the context decision for transparency

### Price Impact Warning
**Recommendation:** Color-coded threshold system:
- < 1% impact: No warning (green text)
- 1-5% impact: Yellow warning text
- > 5% impact: Red warning banner with explicit message
- Calculate impact as: `(executionPrice - spotPrice) / spotPrice`

### Holdings Card
**Recommendation:** Include P&L tracking (simple cost-basis from trade history):
- Show: Token balance, current value in SOL, average buy price, unrealized P&L
- P&L calculated from weighted average of past buys vs current curve price
- This adds value and the data is available from the trade ledger

### Confirmation Flow
**Recommendation:** Review dialog (not one-click) for trades above a threshold:
- Trades < 0.1 SOL: One-click with toast confirmation
- Trades >= 0.1 SOL: Review dialog showing full breakdown before final confirm
- This balances convenience for small trades with safety for larger ones

## Sources

### Primary (HIGH confidence)
- Anchor IDL at `target/idl/baremint.json` - instruction discriminators, account layouts, all verified against source
- `programs/baremint/src/math.rs` - exact constant-product math implementation
- `programs/baremint/src/instructions/buy.rs` and `sell.rs` - on-chain instruction logic, account requirements
- `lib/solana/create-token.ts` - existing @solana/kit transaction construction pattern
- `lib/solana/transfer.ts` - existing server-side signing pattern

### Secondary (MEDIUM confidence)
- TradingView Lightweight Charts v5.1 documentation - https://tradingview.github.io/lightweight-charts/docs
- QuickNode Solana Kit guides - https://www.quicknode.com/guides/solana-development/tooling/web3-2/account-deserialization
- Helius webhook documentation - https://www.helius.dev/docs/webhooks
- Helius SDK GitHub - https://github.com/helius-labs/helius-sdk (v2.1.0, updated Jan 2026)
- Solana token program docs - https://solana.com/docs/tokens/basics/create-token-account

### Tertiary (LOW confidence)
- OHLCV aggregation strategy - based on general SQL knowledge, not verified against specific tooling
- P&L tracking - standard approach but exact UX pattern is discretionary

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries verified, most already in project
- Architecture: HIGH - follows existing codebase patterns exactly, on-chain program fully understood
- Pitfalls: HIGH - derived from direct code analysis of buy.rs/sell.rs and known Solana patterns
- Charting: MEDIUM - lightweight-charts v5 API verified via docs, but SSR interaction with Next.js 16 not directly tested

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (stable domain; libraries unlikely to have breaking changes in 30 days)
