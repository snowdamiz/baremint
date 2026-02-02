# Phase 8: Creator Monetization & Donations - Research

**Researched:** 2026-02-01
**Domain:** Solana on-chain instruction integration (withdraw_creator_fees, claim_vested), off-chain earnings aggregation, SOL/token tip transfers
**Confidence:** HIGH

## Summary

Phase 8 builds the creator-facing monetization layer: an earnings dashboard, vested token claiming, trade fee withdrawal, and viewer-to-creator donations (SOL and token tips). All four on-chain instructions already exist in the Anchor program (`withdraw_creator_fees`, `claim_vested`, plus standard SOL/SPL transfers for tips). The off-chain data model (trades, content_unlocks, bonding curve reads) is already in place from Phases 6 and 7. The primary work is:

1. **Earnings dashboard** -- SQL aggregation of confirmed trades + on-chain reads for real-time accrued fees
2. **Claim vested tokens** -- Build and send `claim_vested` instruction via the existing @solana/kit pipe pattern
3. **Withdraw trade fees** -- Build and send `withdraw_creator_fees` instruction (same pattern)
4. **Donations** -- Simple SOL transfer (reuse `getTransferSolInstruction`) and SPL token transfer for tips, plus a new `donation` DB table for tracking

No new on-chain program instructions are needed. No new npm dependencies are required. The entire phase uses existing patterns established in Phases 6 and 7.

**Primary recommendation:** Follow the exact same `@solana/kit` pipe + PDA derivation + server action pattern used in `lib/solana/trade.ts` for all three on-chain operations. Build the earnings dashboard as a server component with parallel SQL/RPC queries.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @solana/kit | ^5.5.1 | Transaction building, signing, RPC | Already used for all on-chain interactions |
| @solana-program/token | ^0.9.0 | SPL token transfers (for token tips) | Already used for ATA creation in trade.ts |
| drizzle-orm | ^0.45.1 | SQL aggregation for earnings data | Already used for trade history, P&L |
| zod | ^4.3.6 | Input validation for server actions | Already used in trade actions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @solana-program/system | (via @solana/kit) | SOL transfer instruction for tips | Already used in transfer.ts |
| sonner | ^2.0.7 | Toast notifications for tx results | Already used throughout |
| lucide-react | ^0.563.0 | Icons for earnings UI | Already used throughout |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQL aggregation for earnings | On-chain event parsing via Helius | SQL is simpler, data already in DB from trade webhooks; on-chain events would require new webhook parsing |
| Server actions for tx execution | API routes | Server actions already established as the pattern for authenticated transactions (see trade actions.ts) |
| Direct lamport reads for accrued fees | Cached DB values | On-chain reads are authoritative; caching would add staleness risk |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
lib/solana/
├── trade.ts                    # EXISTING: buy, sell, burn (add withdraw_fees, claim_vested)
├── bonding-curve-read.ts       # EXISTING: readBondingCurveAccount (already returns creatorFeesAccrued)
├── bonding-curve-math.ts       # EXISTING: fee/price math
├── vesting-read.ts             # NEW: readVestingAccount, deserializeVesting
├── transfer.ts                 # EXISTING: buildAndSendSolTransfer (reuse for SOL tips)
├── token-transfer.ts           # NEW: buildAndSendTokenTransfer (for token tips)

app/(dashboard)/dashboard/
├── creator/
│   ├── page.tsx                # EXISTING: add earnings dashboard when token exists
│   ├── earnings/
│   │   └── page.tsx            # NEW: detailed earnings breakdown page
│   └── [id]/page.tsx           # EXISTING: public profile (add tip button)

app/trade/[token]/
├── actions.ts                  # EXISTING: trade server actions
├── earnings-actions.ts         # NEW: getCreatorEarnings, claimVestedTokens, withdrawFees
├── donate-actions.ts           # NEW: donateSol, donateToken

lib/db/
├── schema.ts                   # EXISTING: add donation table
```

### Pattern 1: On-Chain Instruction Execution (Withdraw Fees)
**What:** Build, sign, and send `withdraw_creator_fees` instruction following the identical pattern used for buy/sell/burn.
**When to use:** All three on-chain operations (withdraw fees, claim vested, token tips).
**Example:**
```typescript
// Source: Existing pattern from lib/solana/trade.ts
const WITHDRAW_CREATOR_FEES_DISCRIMINATOR = new Uint8Array([/* 8-byte Anchor discriminator */]);

export async function buildAndSendWithdrawCreatorFees(
  userId: string,
  mintAddress: string,
): Promise<{ signature: string; amount: bigint }> {
  // 1. Get user signer (same helper as buy/sell)
  const signer = await getUserSigner(userId);

  // 2. Read on-chain state
  const bondingCurve = await readBondingCurveAccount(mintAddress);
  const amount = bondingCurve.creatorFeesAccrued;

  if (amount === BigInt(0)) {
    throw new Error("No fees to withdraw");
  }

  // 3. Derive PDAs
  const mintAddr = address(mintAddress);
  const pdas = await deriveTradePDAs(mintAddr);

  // 4. Build instruction (discriminator only, no args)
  const instruction: Instruction = {
    programAddress: PROGRAM_ID,
    accounts: [
      { address: signer.address, role: AccountRole.WRITABLE_SIGNER }, // creator
      { address: pdas.bondingCurve, role: AccountRole.WRITABLE },     // bonding_curve
      { address: mintAddr, role: AccountRole.READONLY },               // token_mint
    ],
    data: WITHDRAW_CREATOR_FEES_DISCRIMINATOR,
  };

  // 5. Build, sign, send (same pipe pattern)
  const rpc = createSolanaRpc(getRpcUrl());
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(signer.address, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstructions([instruction], m),
  );

  const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
  const base64Tx = getBase64EncodedWireTransaction(signedTransaction);
  const txSignature = await rpc.sendTransaction(base64Tx, { encoding: "base64" }).send();

  return { signature: txSignature, amount };
}
```

### Pattern 2: Vesting Account Deserialization
**What:** Read and deserialize the VestingAccount PDA to display vesting status and calculate claimable amount.
**When to use:** Earnings dashboard, claim vested tokens flow.
**Example:**
```typescript
// Source: Follows exact pattern from bonding-curve-read.ts
export interface VestingAccountData {
  creator: Address;
  tokenMint: Address;
  totalAllocation: bigint;
  claimedAmount: bigint;
  startTimestamp: bigint; // i64 as BigInt
  isRevoked: boolean;
  bump: number;
}

// Layout (after 8-byte discriminator):
// creator:           Pubkey (32)
// token_mint:        Pubkey (32)
// total_allocation:  u64 (8)
// claimed_amount:    u64 (8)
// start_timestamp:   i64 (8)
// is_revoked:        bool (1)
// bump:              u8 (1)

export async function readVestingAccount(mintAddress: string): Promise<VestingAccountData> {
  const rpc = createSolanaRpc(getRpcUrl());
  const mintBytes = getAddressEncoder().encode(address(mintAddress));

  const [vestingAddress] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: ["vesting", mintBytes],
  });

  const { value: accountInfo } = await rpc
    .getAccountInfo(vestingAddress, { encoding: "base64" })
    .send();

  // Deserialize...
}
```

### Pattern 3: Earnings Aggregation via SQL
**What:** Aggregate creator earnings from multiple sources using SQL on the existing `trade` and `content_unlock` tables.
**When to use:** Earnings dashboard, showing historical revenue.
**Example:**
```typescript
// Source: Follows pattern from getHoldings in trade actions
// Trade fee earnings: sum of creatorFee portion from all confirmed trades on creator's token
const [tradeFeeEarnings] = await db
  .select({
    totalCreatorFees: sql<string>`COALESCE(
      SUM(
        CAST(${trade.feeAmount} AS NUMERIC) / 2  -- creator gets 50% of total fee
      ), 0
    )`,
    tradeCount: sql<number>`COUNT(*)`,
  })
  .from(trade)
  .where(
    and(
      eq(trade.mintAddress, mintAddress),
      eq(trade.status, "confirmed"),
    ),
  );
```

### Pattern 4: SOL Donation (Reuse Transfer)
**What:** SOL tips use the exact same `getTransferSolInstruction` already in `lib/solana/transfer.ts`.
**When to use:** Viewer tipping a creator in SOL.
**Example:**
```typescript
// Source: Existing lib/solana/transfer.ts pattern
// Difference from withdrawal: destination is creator's wallet, not external address
// Record in donation table instead of withdrawal table
```

### Pattern 5: SPL Token Donation
**What:** Token tips transfer creator tokens from viewer's ATA to creator's ATA using SPL token transfer.
**When to use:** Viewer tipping a creator in their token.
**Example:**
```typescript
// Source: @solana-program/token (already installed)
import { getTransferInstruction } from "@solana-program/token";

// Build SPL token transfer: viewer ATA -> creator ATA
// Must ensure creator ATA exists (create-idempotent, same as buy flow)
```

### Anti-Patterns to Avoid
- **Fetching earnings client-side from multiple API calls:** Aggregate on the server in a single SQL query + parallel RPC reads. Don't make the client orchestrate.
- **Caching accrued fees in the database:** The authoritative source is the on-chain bonding curve PDA's `creator_fees_accrued` field. Always read from chain for the "current" value. Use SQL only for historical/completed amounts.
- **Using floating-point for fee calculations:** All fee math must stay BigInt, matching on-chain Rust precision. Display conversion via `Number()` division is safe only at the display layer (already established pattern from [06-02]).
- **Building separate transaction builders for each instruction:** Extend the existing `lib/solana/trade.ts` file with the new instruction builders. They share the same `getUserSigner`, `deriveTradePDAs`, and pipe pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SOL transfer for tips | Custom lamport transfer | `getTransferSolInstruction` from @solana-program/system | Already used in transfer.ts, handles all edge cases |
| SPL token transfer for tips | Manual token instruction encoding | `getTransferInstruction` from @solana-program/token | Already installed, handles ATA validation |
| ATA creation for token tip recipient | Manual ATA derivation + creation | `getCreateAssociatedTokenIdempotentInstructionAsync` | Already used in buy flow, handles idempotency |
| Vesting math (claimable calculation) | Client-side vesting calculation | Read on-chain VestingAccount + GlobalConfig | On-chain is authoritative, client calc would diverge |
| Earnings history formatting | Custom date/number formatters | `Intl.NumberFormat` + existing relative time utility | Already established patterns in the codebase |

**Key insight:** Every on-chain interaction in this phase is a straightforward instruction call following the exact same pattern as buy/sell/burn. The only new complexity is aggregating multiple data sources for the earnings dashboard.

## Common Pitfalls

### Pitfall 1: Creator Wallet Mismatch
**What goes wrong:** The `withdraw_creator_fees` instruction requires the signer's public key to match `bonding_curve.creator`. If the user's custodial wallet doesn't match the on-chain creator address, the transaction fails with `Unauthorized`.
**Why it happens:** The creator's on-chain identity is their Solana public key from when they called `create_token`. If the database/wallet relationship is broken, the addresses won't match.
**How to avoid:** Always verify that the authenticated user's wallet public key matches `bonding_curve.creator` before building the transaction. Fail fast with a clear error message.
**Warning signs:** `Unauthorized` error from Anchor program on fee withdrawal attempts.

### Pitfall 2: Zero Accrued Fees Withdrawal
**What goes wrong:** The on-chain `withdraw_creator_fees` handler returns `Ok(())` if `creator_fees_accrued == 0` (it's a no-op, not an error). This means the transaction succeeds but the creator pays a network fee for nothing.
**Why it happens:** Between reading the bonding curve and sending the transaction, another withdrawal could have already drained the fees.
**How to avoid:** Read `creatorFeesAccrued` from the bonding curve immediately before building the transaction. If zero, skip the transaction entirely and show "No fees to withdraw" in the UI.
**Warning signs:** Successful transactions that don't change the creator's SOL balance.

### Pitfall 3: Vesting Claim Edge Cases
**What goes wrong:** Creator tries to claim but gets `VestingCliffNotReached` even though they think enough time has passed. Or claims succeed but return 0 tokens.
**Why it happens:** Weekly snapping means first claim is at cliff + 7 days (day 37), not at cliff itself (day 30). Also, the on-chain program uses `Clock::get()` for the current time, which may differ from the client's clock.
**How to avoid:** Read the VestingAccount and GlobalConfig from chain. Calculate claimable amount using the same weekly snapping logic as on-chain. Show the next claim date clearly in the UI. Disable the claim button when claimable is 0.
**Warning signs:** `VestingCliffNotReached` or `VestingFullyClaimed` errors after UI shows tokens are available. Per [02-04]: first claim at day 37, max ~93.3% claimable.

### Pitfall 4: Donation to Wrong Address
**What goes wrong:** SOL or token tip goes to the wrong wallet, or to a wallet that doesn't have an ATA for the token.
**Why it happens:** The creator's wallet address must be looked up from the database (wallet table via creatorProfile -> user -> wallet). If this lookup chain is broken, the tip goes nowhere useful.
**How to avoid:** For SOL tips, the destination is the creator's custodial wallet `publicKey`. For token tips, derive the creator's ATA from their wallet address + the mint. Use `getCreateAssociatedTokenIdempotentInstructionAsync` to ensure the ATA exists before transferring.
**Warning signs:** Tips disappearing, tokens sent to non-existent ATAs.

### Pitfall 5: Earnings Dashboard Double-Counting
**What goes wrong:** The dashboard shows inflated earnings because it counts both pending and confirmed trades, or counts both the trade fee and the full SOL amount.
**Why it happens:** The `trade.feeAmount` is the TOTAL fee (platform + creator). Creator's share is exactly half. Also, pending trades haven't been confirmed yet and may fail.
**How to avoid:** Always filter by `status = 'confirmed'` in SQL aggregations. Calculate creator fee as `feeAmount / 2` (matching the on-chain 50/50 split). Cross-reference with `bonding_curve.creator_fees_accrued` for the authoritative un-withdrawn amount.
**Warning signs:** Dashboard total doesn't match on-chain state.

### Pitfall 6: Token Tip Reduces Viewer's Holding Below Gating Threshold
**What goes wrong:** Viewer tips tokens to a creator and then can no longer view the creator's hold-gated content because their balance dropped below the threshold.
**Why it happens:** Token tips transfer tokens from viewer to creator, reducing the viewer's balance.
**How to avoid:** Show a warning in the tip dialog when the tip amount would reduce the viewer's balance below the creator's content gating threshold. This is a UX concern, not a blocking issue.
**Warning signs:** User complaints about losing content access after tipping.

## Code Examples

### Anchor Discriminator Extraction
```typescript
// Source: Existing pattern from lib/solana/trade.ts
// The discriminator for each instruction is the first 8 bytes of sha256("global:instruction_name")

// withdraw_creator_fees discriminator
// sha256("global:withdraw_creator_fees") -> first 8 bytes
const WITHDRAW_CREATOR_FEES_DISCRIMINATOR = new Uint8Array([/* compute from IDL */]);

// claim_vested discriminator
const CLAIM_VESTED_DISCRIMINATOR = new Uint8Array([/* compute from IDL */]);
```

### WithdrawCreatorFees Account Layout
```typescript
// Source: programs/baremint/src/instructions/withdraw_fees.rs
// Accounts for WithdrawCreatorFees:
// 1. creator (signer, mut)       -> user's wallet
// 2. bonding_curve (mut)         -> PDA: ["bonding_curve", mint]
// 3. token_mint (readonly)       -> the SPL mint
//
// No global_config needed (unlike WithdrawPlatformFees which checks authority)
// Constraint: creator.key() == bonding_curve.creator
```

### ClaimVested Account Layout
```typescript
// Source: programs/baremint/src/instructions/claim_vested.rs
// Accounts for ClaimVested:
// 1. creator (signer, mut)              -> user's wallet
// 2. global_config (readonly)           -> PDA: ["global_config"]
// 3. vesting_account (mut)              -> PDA: ["vesting", mint]
// 4. token_mint (readonly)              -> the SPL mint
// 5. vesting_token_account (mut)        -> PDA: ["vesting_tokens", mint] (token::authority = vesting_account)
// 6. creator_token_account (mut)        -> creator's ATA for the mint
// 7. token_program (readonly)           -> TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
//
// Constraint: creator.key() == vesting_account.creator
```

### Earnings SQL Aggregation
```typescript
// Source: Follows existing pattern from getHoldings in app/trade/[token]/actions.ts

// 1. Trade fee revenue (creator's 50% share of all confirmed trade fees)
const [tradeFees] = await db
  .select({
    total: sql<string>`COALESCE(SUM(CAST(${trade.feeAmount} AS NUMERIC) / 2), 0)`,
    count: sql<number>`COUNT(*)`,
  })
  .from(trade)
  .where(and(
    eq(trade.mintAddress, mintAddress),
    eq(trade.status, "confirmed"),
  ));

// 2. Burn revenue (creator's 50% share of burn fees)
// Burns are deflationary: fees come from reserves, tracked in bonding_curve.creator_fees_accrued
// The trade table doesn't track burns; use content_unlock + on-chain reads
const [burnCount] = await db
  .select({ count: sql<number>`COUNT(*)` })
  .from(contentUnlock)
  .innerJoin(post, eq(contentUnlock.postId, post.id))
  .where(eq(post.creatorProfileId, creatorProfileId));

// 3. On-chain current accrued (not yet withdrawn)
const bondingCurve = await readBondingCurveAccount(mintAddress);
const currentAccrued = bondingCurve.creatorFeesAccrued; // BigInt, lamports
```

### Donation DB Table
```typescript
// New table in lib/db/schema.ts
export const donation = pgTable("donation", {
  id: text("id").primaryKey(),
  fromUserId: text("from_user_id")
    .notNull()
    .references(() => user.id),
  toCreatorProfileId: text("to_creator_profile_id")
    .notNull()
    .references(() => creatorProfile.id),
  type: text("type").notNull(), // "sol" | "token"
  amount: text("amount").notNull(), // lamports (SOL) or raw token amount as BigInt string
  mintAddress: text("mint_address"), // null for SOL tips, mint address for token tips
  txSignature: text("tx_signature").notNull(),
  status: text("status").notNull().default("pending"), // pending | confirmed | failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});
```

### Vesting Claimable Calculation (Client-Side Preview)
```typescript
// Source: Matches on-chain logic from programs/baremint/src/instructions/claim_vested.rs
// Used for UI display only; on-chain is authoritative for actual claims

function calculateClaimable(
  vesting: VestingAccountData,
  config: GlobalConfigAccount,
): bigint {
  if (vesting.isRevoked) return BigInt(0);

  const now = BigInt(Math.floor(Date.now() / 1000));
  const cliffEnd = vesting.startTimestamp + config.vestingCliffSeconds;

  if (now < cliffEnd) return BigInt(0);

  const elapsedSinceCliff = now - cliffEnd < config.vestingDurationSeconds
    ? now - cliffEnd
    : config.vestingDurationSeconds;

  // Weekly snapping
  const weeksElapsed = elapsedSinceCliff / config.vestingClaimIntervalSeconds;
  const snappedElapsed = weeksElapsed * config.vestingClaimIntervalSeconds;

  // Linear vesting
  const totalVested = (vesting.totalAllocation * snappedElapsed) / config.vestingDurationSeconds;
  const claimable = totalVested - vesting.claimedAmount;

  return claimable > BigInt(0) ? claimable : BigInt(0);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @solana/web3.js v1 (Transaction class) | @solana/kit v5 (pipe + TransactionMessage) | 2024 | Already adopted in this codebase; all new tx builders use kit |
| Anchor IDL client generation | Manual discriminator + account encoding | Phase 2 | Already established; no IDL client needed at runtime |
| Separate fee vaults | Single PDA with accrual fields | Phase 2 design | Simpler: one PDA holds all SOL, accrual fields track splits |

**Deprecated/outdated:**
- @solana/web3.js v1 Transaction class: Not used in this project; everything uses @solana/kit v5 pipe pattern
- Anchor IDL TypeScript client: Not used; all instructions are manually encoded with discriminators

## Open Questions

1. **Donation webhook confirmation**
   - What we know: Trades use Helius webhooks for confirmation. Burns create content_unlock records immediately (optimistic).
   - What's unclear: Should donations also use webhook confirmation, or can they be optimistic like burns?
   - Recommendation: Use optimistic approach (like burns) with a `donation` table that records `status: "confirmed"` immediately after `sendTransaction`. The SOL/token transfer is a simple system program or SPL transfer, not a complex program instruction. If needed, add webhook confirmation later. This matches the existing `withdrawal` table pattern which sets `status: "confirmed"` right after send.

2. **Earnings dashboard data staleness**
   - What we know: Trade fees are calculated from the trade table (off-chain ledger synced via webhooks). Accrued fees are read from on-chain.
   - What's unclear: How stale can the dashboard data be? Should we poll or use revalidation?
   - Recommendation: Server component with `fetch` cache disabled (or short revalidation). On-chain reads for current accrued amount, SQL for historical totals. No real-time polling needed for MVP.

3. **Anchor discriminators for new instructions**
   - What we know: The existing discriminators in trade.ts are hardcoded Uint8Arrays. These are derived from `sha256("global:instruction_name")`.
   - What's unclear: Exact byte values for `withdraw_creator_fees` and `claim_vested`.
   - Recommendation: Compute during implementation by running `sha256("global:withdraw_creator_fees")` and `sha256("global:claim_vested")` and taking the first 8 bytes. Alternatively, extract from the Anchor IDL JSON if available. The existing BUY/SELL/BURN discriminators were computed the same way.

## Sources

### Primary (HIGH confidence)
- `/Users/sn0w/Documents/dev/baremint/programs/baremint/src/instructions/withdraw_fees.rs` -- On-chain withdraw_creator_fees instruction, account layout, constraints
- `/Users/sn0w/Documents/dev/baremint/programs/baremint/src/instructions/claim_vested.rs` -- On-chain claim_vested instruction, vesting math, account layout
- `/Users/sn0w/Documents/dev/baremint/programs/baremint/src/state/bonding_curve.rs` -- BondingCurve struct with creatorFeesAccrued field
- `/Users/sn0w/Documents/dev/baremint/programs/baremint/src/state/vesting.rs` -- VestingAccount struct layout
- `/Users/sn0w/Documents/dev/baremint/programs/baremint/src/state/global_config.rs` -- GlobalConfig with vesting parameters
- `/Users/sn0w/Documents/dev/baremint/lib/solana/trade.ts` -- Existing transaction builder patterns (buy, sell, burn)
- `/Users/sn0w/Documents/dev/baremint/lib/solana/bonding-curve-read.ts` -- Existing deserialization patterns
- `/Users/sn0w/Documents/dev/baremint/lib/solana/transfer.ts` -- Existing SOL transfer pattern (reusable for tips)
- `/Users/sn0w/Documents/dev/baremint/app/trade/[token]/actions.ts` -- Server action patterns, SQL aggregation, BigInt handling
- `/Users/sn0w/Documents/dev/baremint/lib/db/schema.ts` -- Current database schema (trade, contentUnlock tables)
- `/Users/sn0w/Documents/dev/baremint/.planning/STATE.md` -- Prior decisions affecting this phase

### Secondary (MEDIUM confidence)
- Existing VestingTimeline component shows vesting progress client-side but doesn't read on-chain state
- Existing CreatorOwnProfile component is the natural home for earnings dashboard integration

### Tertiary (LOW confidence)
- None -- all findings come from direct codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used in codebase
- Architecture: HIGH -- all patterns directly observed in existing Phase 6/7 code
- Pitfalls: HIGH -- derived from on-chain program source code and established constraints in STATE.md

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (stable -- no external dependencies changing)
