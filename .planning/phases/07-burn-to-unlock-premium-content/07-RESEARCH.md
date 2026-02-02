# Phase 7: Burn-to-Unlock Premium Content - Research

**Researched:** 2026-02-01
**Domain:** Solana on-chain burn instruction integration, off-chain access grant persistence, token-gated content unlock UX
**Confidence:** HIGH

## Summary

This phase connects the existing on-chain `burn_for_access` instruction (built in Phase 02-03) to the frontend unlock flow (scaffolded in Phase 05-03). The on-chain side is complete and tested -- the work is entirely frontend transaction building, off-chain access tracking, and UI updates.

The critical finding is that **the roadmap description is inaccurate**: it says "SOL returned from the bonding curve to the viewer's wallet proportional to tokens burned," but the actual on-chain instruction is **purely deflationary** -- no SOL is returned to the viewer. Tokens are destroyed, fees are extracted from curve reserves into accrual fields, and `virtual_token_reserves` stays unchanged (which increases the token price for remaining holders). This was a deliberate design decision documented in [02-03] and confirmed by reading `burn_access.rs` directly. The frontend must reflect this accurately: the viewer pays by burning tokens, receives no SOL back, and gains permanent content access in return.

The main technical work involves: (1) a `buildAndSendBurnForAccess` transaction builder mirroring the existing buy/sell pattern, (2) a new `content_unlock` DB table to track permanent access grants, (3) updating `checkContentAccess` to check unlock records for burn_gated posts, and (4) replacing the placeholder "Burn to Unlock" toast with a real confirmation flow showing estimated token cost and fee breakdown.

**Primary recommendation:** Build a `buildAndSendBurnForAccess` transaction builder following the exact same `@solana/kit` pipe pattern as `trade.ts`, add a `content_unlock` table for permanent access persistence, update the access control layer to check unlocks, and wire the existing UnlockDialog with real burn execution.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @solana/kit | (existing) | Transaction building, signing, RPC | Already used for all Solana interactions in this project |
| @solana-program/token | (existing) | ATA derivation | Already used in trade.ts |
| drizzle-orm | (existing) | Database queries for unlock records | Already used for all DB operations |
| zod | (existing) | Input validation for burn actions | Already used in trade actions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | (existing) | Toast notifications for burn status | Success/failure feedback |
| lucide-react | (existing) | Flame icon for burn UI | Already imported in unlock-dialog.tsx |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DB-backed unlock records | On-chain PDA per viewer per post | DB is simpler, cheaper, and sufficient since the on-chain burn is the source of truth; the off-chain record just caches access state |
| Server-side tx building | Client-side wallet signing | Server-side (custodial) matches existing pattern -- user wallets are server-managed with encrypted keys |

**Installation:**
No new packages needed. All libraries are already in the project.

## Architecture Patterns

### Recommended Project Structure
```
lib/solana/burn-for-access.ts     # Transaction builder (new)
lib/solana/bonding-curve-math.ts  # Add calculateTokensForSolValue (port from Rust)
app/api/burn/route.ts             # OR use server action in existing actions.ts pattern
lib/db/schema.ts                  # Add content_unlock table
lib/content/access-control.ts     # Update checkContentAccess for unlock records
components/content/unlock-dialog.tsx  # Replace placeholder with real burn flow
```

### Pattern 1: Transaction Builder (Mirror of trade.ts)
**What:** Server-side transaction building with custodial wallet signing
**When to use:** For the burn_for_access on-chain instruction
**Example:**
```typescript
// Source: lib/solana/trade.ts (existing pattern)
// burn_for_access has NO arguments (burn_sol_price is read from bonding curve on-chain)
const BURN_FOR_ACCESS_DISCRIMINATOR = new Uint8Array([77, 60, 201, 5, 156, 231, 61, 29]);

// Instruction accounts (from burn_access.rs):
// 1. viewer (signer, mut)
// 2. global_config (readonly, PDA)
// 3. bonding_curve (mut, PDA)
// 4. token_mint (mut) -- mint account gets modified by burn
// 5. viewer_token_account (mut) -- tokens burned from here
// 6. token_program (readonly)
//
// NOTE: No system_program needed (unlike buy/sell which transfer SOL)
// NOTE: No curve_token_account needed (tokens are burned, not transferred)
```

### Pattern 2: Burn Cost Estimation (Client-Side Preview)
**What:** Calculate tokens-to-burn before executing, for user confirmation
**When to use:** Before showing the burn confirmation dialog
**Example:**
```typescript
// Source: programs/baremint/src/math.rs (calculate_tokens_for_sol_value)
// Port to lib/solana/bonding-curve-math.ts
export function calculateTokensForSolValue(
  virtualSolReserves: bigint,
  virtualTokenReserves: bigint,
  solValue: bigint,
): bigint {
  if (solValue === BigInt(0)) return BigInt(0);
  // Ceiling division (rounds UP -- protocol-favorable, more tokens burned)
  const numerator = solValue * virtualTokenReserves + (virtualSolReserves - BigInt(1));
  return numerator / virtualSolReserves;
}

// Usage for burn estimate:
// const burnSolPrice = bondingCurve.burnSolPrice; // from readBondingCurveAccount
// const tokensToBurn = calculateTokensForSolValue(vSol, vToken, burnSolPrice);
// const totalFee = calculateFee(burnSolPrice, globalConfig.feeBps);
```

### Pattern 3: Permanent Access Record
**What:** Database table tracking which viewer unlocked which post via burn
**When to use:** After a successful burn transaction is confirmed
**Example:**
```typescript
// New table in schema.ts
export const contentUnlock = pgTable("content_unlock", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  postId: text("post_id").notNull().references(() => post.id),
  txSignature: text("tx_signature").notNull(),
  tokensBurned: text("tokens_burned").notNull(), // raw token amount as string
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("content_unlock_user_post_idx").on(table.userId, table.postId),
]);
```

### Pattern 4: Access Control Update
**What:** Bifurcate burn_gated check from hold_gated
**When to use:** In checkContentAccess for burn_gated posts
**Example:**
```typescript
// For burn_gated posts, check content_unlock table FIRST
// If unlock record exists -> hasAccess = true (permanent)
// If no unlock record -> hasAccess = false (show burn dialog)
// Note: burn_gated does NOT fall through to balance check
// The balance check is only for hold_gated posts
```

### Anti-Patterns to Avoid
- **Using tokenThreshold as burn cost for burn_gated posts:** The on-chain burn cost comes from `bonding_curve.burn_sol_price` (set at token creation time), NOT from the post's `tokenThreshold`. The `tokenThreshold` field for burn_gated posts is currently used in the publish flow but has a semantic mismatch. Decision needed: repurpose `tokenThreshold` or ignore it for burn_gated.
- **Returning SOL to the viewer:** The roadmap description is wrong. The on-chain instruction is deflationary -- no SOL is returned. The UI must NOT promise SOL back.
- **Floating point math for burn estimates:** All token/SOL calculations must use BigInt, matching the on-chain u64/u128 precision. Use `Number()` only for display formatting.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transaction building | Custom serialization | Existing `@solana/kit` pipe pattern from `trade.ts` | Matches codebase conventions, handles blockhash, signing, encoding |
| Burn cost calculation | Approximate pricing | Port of `calculate_tokens_for_sol_value` from Rust | Must match on-chain math exactly (ceiling division) |
| ATA derivation | Manual PDA calculation | `findAssociatedTokenPda` from `@solana-program/token` | Already used in trade.ts |
| Fee estimation | Custom fee logic | Existing `calculateFee()` from bonding-curve-math.ts | Already matches on-chain `calculate_fee` |

**Key insight:** The on-chain instruction is zero-argument (`burnForAccess()` takes no params) -- the burn amount is calculated from `bonding_curve.burn_sol_price` and current reserves. The client-side estimate mirrors this but is informational only.

## Common Pitfalls

### Pitfall 1: Confusing burn_sol_price with tokenThreshold
**What goes wrong:** The post schema has `tokenThreshold` (used for gating), but burn_for_access uses `bonding_curve.burn_sol_price` (set per-token at creation time). These are different values.
**Why it happens:** Both look like "cost to access gated content" but operate at different levels. `burn_sol_price` is a SOL-denominated amount set once per token. `tokenThreshold` is a per-post token amount.
**How to avoid:** For burn_gated posts, the burn cost is always `burn_sol_price` from the bonding curve, NOT `tokenThreshold` from the post. The number of tokens burned depends on current reserves (price). Consider: should `tokenThreshold` be removed/ignored for burn_gated, or should it serve a different purpose (like "minimum tokens to hold before burning")?
**Warning signs:** UI showing a different burn cost than what the transaction actually burns.

### Pitfall 2: Not handling the burn_sol_price = 0 case
**What goes wrong:** If a creator's token was launched with `burn_sol_price = 0`, the on-chain instruction rejects with `BurnDisabled`.
**Why it happens:** Not all tokens support burning -- the creator chooses this at launch time.
**How to avoid:** Before showing burn UI, check `bondingCurve.burnSolPrice > 0`. If zero, show "Burn not available for this token" instead of a burn button. This should also affect the post composer -- if a creator's token has `burn_sol_price = 0`, the burn_gated option should be disabled or hidden.
**Warning signs:** Error toast after attempting burn on a token that has burns disabled.

### Pitfall 3: Race condition between burn TX and unlock record creation
**What goes wrong:** Burn transaction succeeds on-chain but server fails to create the unlock record, leaving the viewer with burned tokens and no access.
**Why it happens:** Network failures, server errors between TX confirmation and DB write.
**How to avoid:** Insert the unlock record as "pending" BEFORE sending the TX (with tx_signature), then update to "confirmed" after. If the server crashes, the pending record can be reconciled by checking the TX signature on-chain. Alternatively, use an optimistic approach: record immediately on TX send, since the burned tokens are the source of truth.
**Warning signs:** User reports "I burned tokens but don't have access."

### Pitfall 4: Token mint account must be writable
**What goes wrong:** Transaction fails because `token_mint` is passed as readonly.
**Why it happens:** In the burn_access.rs instruction, `token_mint` has `#[account(mut)]` because SPL token burn reduces the mint's supply counter.
**How to avoid:** Set `token_mint` account role to `AccountRole.WRITABLE` in the instruction builder.
**Warning signs:** Transaction simulation error about read-only account.

### Pitfall 5: Displaying "SOL return" to viewers
**What goes wrong:** UI promises SOL back from burn, but the on-chain instruction returns no SOL.
**Why it happens:** The roadmap description is misleading.
**How to avoid:** UI should clearly state: "Burn X tokens for permanent access. Fee: Y SOL from curve reserves (platform + creator)." Show the fee breakdown but do NOT mention SOL return to the viewer.
**Warning signs:** Users confused about missing SOL after burning.

## Code Examples

### Building the burn_for_access transaction
```typescript
// Source: Derived from lib/solana/trade.ts pattern + programs/baremint/src/instructions/burn_access.rs
const BURN_FOR_ACCESS_DISCRIMINATOR = new Uint8Array([77, 60, 201, 5, 156, 231, 61, 29]);

// No arguments -- just the 8-byte discriminator
const burnData = new Uint8Array(8);
burnData.set(BURN_FOR_ACCESS_DISCRIMINATOR, 0);

const burnInstruction: Instruction = {
  programAddress: PROGRAM_ID,
  accounts: [
    { address: signer.address, role: AccountRole.WRITABLE_SIGNER },  // viewer
    { address: pdas.globalConfig, role: AccountRole.READONLY },       // global_config
    { address: pdas.bondingCurve, role: AccountRole.WRITABLE },       // bonding_curve
    { address: mintAddr, role: AccountRole.WRITABLE },                // token_mint (mut!)
    { address: viewerAta, role: AccountRole.WRITABLE },               // viewer_token_account
    { address: TOKEN_PROGRAM, role: AccountRole.READONLY },           // token_program
  ],
  data: burnData,
};
// NOTE: No system_program account (unlike buy/sell)
// NOTE: No curve_token_account (tokens burned, not transferred back)
```

### Estimating burn cost for UI preview
```typescript
// Source: Derived from programs/baremint/src/math.rs
export function estimateBurn(
  burnSolPrice: bigint,
  feeBps: number,
  virtualSolReserves: bigint,
  virtualTokenReserves: bigint,
): {
  tokensToBurn: bigint;
  totalFee: bigint;
  platformFee: bigint;
  creatorFee: bigint;
} {
  const tokensToBurn = calculateTokensForSolValue(
    virtualSolReserves,
    virtualTokenReserves,
    burnSolPrice,
  );
  const totalFee = calculateFee(burnSolPrice, feeBps);
  const platformFee = totalFee / BigInt(2);
  const creatorFee = totalFee - platformFee;

  return { tokensToBurn, totalFee, platformFee, creatorFee };
}
```

### Updated checkContentAccess for burn_gated
```typescript
// Source: Derived from lib/content/access-control.ts
// For burn_gated posts, check permanent unlock record first
if (postData.accessLevel === "burn_gated") {
  const [unlock] = await db
    .select()
    .from(contentUnlock)
    .where(
      and(
        eq(contentUnlock.userId, viewerUserId),
        eq(contentUnlock.postId, postId),
      ),
    )
    .limit(1);

  if (unlock) {
    return { hasAccess: true, viewerBalance: balance.toString() };
  }

  // No unlock record: viewer needs to burn
  return { hasAccess: false, viewerBalance: balance.toString() };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Placeholder toast "coming soon" | Real burn execution | Phase 7 (now) | Users can actually burn to unlock |
| Balance-check for burn_gated (same as hold_gated) | Permanent unlock record check | Phase 7 (now) | Burn-gated is truly "one-time purchase" semantics |

**Deprecated/outdated:**
- The roadmap's claim of "SOL returned from the bonding curve" is incorrect per the on-chain implementation. The instruction is deflationary by design.

## Critical Design Decisions Needed

### 1. tokenThreshold semantics for burn_gated posts
**Current state:** The post composer sets `tokenThreshold` for burn_gated posts. The on-chain burn cost comes from `bonding_curve.burn_sol_price`. These are unrelated values.
**Options:**
  - (a) **Ignore tokenThreshold for burn_gated**: Use only `burn_sol_price`. The tokenThreshold field in the post table is null/unused for burn_gated posts. The burn cost is per-token, not per-post.
  - (b) **Use tokenThreshold as display-only**: Store it for UI purposes but the actual burn amount comes from the chain.
  - (c) **Per-post burn cost**: Would require a new on-chain instruction (not built).
**Recommendation:** Option (a) -- burn cost is per-token (from `burn_sol_price`), not per-post. This matches the on-chain design where `burn_for_access` reads from the bonding curve, not from any post-level data. The tokenThreshold input should be hidden/removed for burn_gated in the composer.

### 2. Burn cost visibility in the UI
**What to show:** The viewer needs to know: (1) how many tokens will be burned, (2) whether they have enough, (3) the fee extracted from curve reserves. They should NOT be told they'll receive SOL back.
**Recommendation:** Show "Burn ~X $TICKER tokens for permanent access" with a "Fee: Y SOL (extracted from curve)" note. The token count is an estimate (depends on current reserves) -- add "approximate" language.

### 3. Handling per-token vs per-post burn cost
**Current on-chain design:** `burn_sol_price` is set once per token at creation time. Every burn_for_access call on that token burns the same SOL-equivalent of tokens. There is no per-post burn cost.
**Implication:** All burn_gated posts by the same creator have the same burn cost. This is a design constraint, not a bug. The UI should make this clear.

## Open Questions

1. **Should the creator be able to update burn_sol_price after launch?**
   - What we know: Currently it's set once in `create_token` and never updated. There's no `update_burn_price` instruction.
   - What's unclear: Whether this is intentional or an oversight.
   - Recommendation: For Phase 7, treat it as immutable. If needed, a new instruction can be added later.

2. **What should the post composer show for burn_gated?**
   - What we know: Currently it asks for `tokenThreshold` for burn_gated, but this doesn't map to the on-chain burn cost.
   - What's unclear: Whether the composer should show the burn cost (from chain) or remove the input entirely.
   - Recommendation: Remove the tokenThreshold input for burn_gated. Instead, display the current burn cost (read from bonding curve) as informational text: "Viewers will burn ~X tokens (Y SOL equivalent) to unlock."

3. **How to handle burn_gated when burn_sol_price is 0?**
   - What we know: If `burn_sol_price = 0`, the on-chain instruction fails with `BurnDisabled`.
   - What's unclear: Should the creator even be allowed to create burn_gated posts if their token has burns disabled?
   - Recommendation: Block burn_gated option in the composer when `burn_sol_price = 0`. Show a message like "Burn access not available -- enable it when launching your next token."

## Sources

### Primary (HIGH confidence)
- `programs/baremint/src/instructions/burn_access.rs` -- On-chain burn instruction, deflationary design confirmed
- `programs/baremint/src/math.rs` -- `calculate_tokens_for_sol_value` ceiling division, `calculate_fee` ceiling division
- `programs/baremint/src/state/bonding_curve.rs` -- `burn_sol_price` field (u64, SOL-denominated, 0 = disabled)
- `programs/baremint/src/lib.rs` -- `burn_for_access` takes no arguments (Context<BurnAccess> only)
- `target/idl/baremint.json` -- Discriminator: [77, 60, 201, 5, 156, 231, 61, 29]
- `tests/burn.test.ts` -- 7 comprehensive tests confirming deflationary behavior
- `lib/solana/trade.ts` -- Transaction builder pattern (buy/sell) to mirror
- `lib/solana/bonding-curve-math.ts` -- Client-side math (missing `calculateTokensForSolValue`)
- `lib/solana/bonding-curve-read.ts` -- `readBondingCurveAccount` includes `burnSolPrice`
- `app/trade/[token]/actions.ts` -- Server action pattern for executeBuy/executeSell
- `lib/content/access-control.ts` -- Current checkContentAccess (treats burn_gated same as hold_gated)
- `components/content/unlock-dialog.tsx` -- Existing scaffold with placeholder "Burn-to-unlock coming soon" toast
- `components/content/post-composer.tsx` -- Two-step publish with access level selection
- `app/api/content/[postId]/media/route.ts` -- Gated media API returning locked/unlocked responses
- `lib/db/schema.ts` -- No content_unlock table yet; post table has accessLevel "burn_gated"

### Secondary (MEDIUM confidence)
- `.planning/phases/02-bonding-curve-smart-contract/02-03-SUMMARY.md` -- Confirms deflationary burn design decision
- `.planning/phases/05-token-gated-content/05-03-PLAN.md` -- Confirms placeholder buy/burn buttons for Phase 7 wiring

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already exist in the project, no new dependencies
- Architecture: HIGH - Pattern is a direct mirror of existing buy/sell flow with one new DB table
- Pitfalls: HIGH - All identified from reading actual source code and on-chain instruction behavior

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (stable -- on-chain program is deployed and tested)
