# Phase 2: Bonding Curve Smart Contract - Research

**Researched:** 2026-02-01
**Domain:** Solana Anchor program development, bonding curve token economics, SPL token operations
**Confidence:** HIGH

## Summary

This research covers everything needed to plan an Anchor-based bonding curve smart contract for creator tokens on Solana. The program must handle token creation (1B fixed supply, mint authority revoked), buy/sell via bonding curve with 5% fees, burn-for-access (deflationary, no SOL return to burner), creator vesting (30d cliff + 60d linear vest), and fee distribution to platform/creator vaults.

The standard approach is an Anchor 0.32.1 program using the constant product bonding curve formula (x * y = k) with virtual reserves, which is the same model proven by pump.fun (11.9M+ tokens launched) and Moonshot. This model provides continuous liquidity, predictable pricing, and is well-understood by the Solana ecosystem. The program uses SPL Token (not Token-2022) for simplicity, `u128` intermediate math to prevent overflow, and `anchor-bankrun` for fast testing.

Key recommendations: Use constant product curve with virtual reserves for pricing (not linear or sigmoid -- constant product is battle-tested on Solana), express all fees in basis points (250 bps = 2.5%), use checked arithmetic everywhere, and structure PDAs with unique string prefixes per account type.

**Primary recommendation:** Build a constant product (x * y = k) bonding curve with virtual reserves using Anchor 0.32.1, SPL Token CPIs, and u128 intermediate math, tested via anchor-bankrun.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Anchor Framework | 0.32.1 (stable) | Solana program framework | Industry standard, built-in security checks, account validation, PDA management |
| anchor-lang | 0.32.1 | Rust crate for program logic | Provides #[program], #[account], constraints system |
| anchor-spl | 0.32.1 | SPL Token CPI helpers | Type-safe mint, burn, transfer operations via CPI |
| solana-program | 2.x | Solana runtime types | Core types (Pubkey, AccountInfo, etc.) |
| spl-token | 6.x | SPL Token program interface | Token mint, burn, transfer definitions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| anchor-bankrun | latest | Fast Anchor testing | All program tests (orders of magnitude faster than solana-test-validator) |
| solana-bankrun | latest | Bankrun core engine | Underlying test runtime with time manipulation |
| @coral-xyz/anchor | 0.32.1 | TypeScript client | Test scripts and client-side interaction |
| @solana/web3.js | 1.x or 2.x | Solana JS SDK | Transaction building in tests |
| spl-math (PreciseNumber) | latest | High-precision fixed-point math | Complex curve calculations if u128 is insufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Anchor 0.32.1 | Anchor 1.0.0-rc.2 | RC is newer but not stable; 0.32.1 is battle-tested |
| SPL Token | Token-2022 | Token-2022 adds extensions (transfer hooks, etc.) but adds complexity; not needed here |
| anchor-bankrun | solana-test-validator | Test validator is slower by orders of magnitude; bankrun supports time manipulation |
| spl-math PreciseNumber | ra-solana-math FixedPoint | ra-solana-math is newer/less proven; spl-math is from Solana Labs |

**Installation (Rust):**
```toml
[dependencies]
anchor-lang = "0.32.1"
anchor-spl = "0.32.1"

[dev-dependencies]
# Tests are in TypeScript via anchor-bankrun
```

**Installation (TypeScript tests):**
```bash
npm install --save-dev @coral-xyz/anchor @solana/web3.js anchor-bankrun solana-bankrun jest @types/jest ts-jest
```

## Architecture Patterns

### Recommended Project Structure
```
programs/baremint/
├── Cargo.toml
├── Xargo.toml
└── src/
    ├── lib.rs              # Program entry, declare_id!, module registration
    ├── instructions/
    │   ├── mod.rs           # Re-exports all instructions
    │   ├── initialize.rs    # Initialize GlobalConfig
    │   ├── create_token.rs  # Create token mint + bonding curve + vesting
    │   ├── buy.rs           # Buy tokens from curve
    │   ├── sell.rs          # Sell tokens back to curve
    │   ├── burn_access.rs   # Burn tokens for content access
    │   ├── claim_vested.rs  # Creator claims vested tokens
    │   ├── withdraw_fees.rs # Withdraw accumulated fees
    │   └── revoke_vesting.rs # Admin burns unvested tokens on ban
    ├── state/
    │   ├── mod.rs           # Re-exports all state
    │   ├── global_config.rs # GlobalConfig account
    │   ├── bonding_curve.rs # BondingCurve account
    │   └── vesting.rs       # VestingAccount
    ├── errors.rs            # Custom error enum
    └── math.rs              # Curve calculation functions (pure math, testable)
tests/
├── setup.ts                # Test helpers, bankrun initialization
├── initialize.test.ts      # GlobalConfig tests
├── create_token.test.ts    # Token creation tests
├── buy_sell.test.ts         # Trading tests
├── burn.test.ts            # Burn-for-access tests
├── vesting.test.ts         # Vesting tests
└── fees.test.ts            # Fee collection/withdrawal tests
Anchor.toml
```

### Pattern 1: Constant Product Bonding Curve with Virtual Reserves
**What:** The bonding curve uses the formula `virtual_token_reserves * virtual_sol_reserves = k` (constant product). Virtual reserves are synthetic values used for price calculation; real reserves track actual SOL/token holdings.
**When to use:** Every buy and sell instruction.
**Why this curve:** Constant product is battle-tested on Solana (pump.fun, Moonshot, Meteora DBC). It provides continuous liquidity, smooth price curves, and is well-understood. Linear curves create abrupt pricing; sigmoid curves add unnecessary complexity. Constant product naturally rewards early buyers with lower prices that accelerate as supply decreases.

**Initial Parameters (recommended for creator token economy):**
```
Total supply:              1,000,000,000 tokens (1B, 6 decimals = 1_000_000_000_000_000 base units)
Curve allocation:          900,000,000 tokens (900M)
Creator vesting:           100,000,000 tokens (100M)

Virtual token reserves:    1,073,000,000 tokens (in base units with decimals)
Virtual SOL reserves:      30 SOL (30_000_000_000 lamports)
Real token reserves:       793,100,000 tokens (in base units -- less than virtual, creates liquidity gap)
Real SOL reserves:         0 (starts empty)

Initial token price:       ~0.000000028 SOL per token
k (constant):              virtual_token_reserves * virtual_sol_reserves
```

These values are modeled on pump.fun's proven parameters, adjusted for the 90/10 distribution model. The virtual reserves being larger than real reserves creates a "liquidity gap" that ensures the curve never runs dry.

**Price calculation:**
```rust
// Price of 1 token in SOL
price = virtual_sol_reserves / virtual_token_reserves

// Buy: how many tokens for `sol_amount` SOL (before fees)
new_virtual_sol = virtual_sol_reserves + sol_amount
new_virtual_token = k / new_virtual_sol
tokens_out = virtual_token_reserves - new_virtual_token

// Sell: how much SOL for `token_amount` tokens (before fees)
new_virtual_token = virtual_token_reserves + token_amount
new_virtual_sol = k / new_virtual_token
sol_out = virtual_sol_reserves - new_virtual_sol
```

### Pattern 2: PDA Seed Design
**What:** Deterministic account addresses derived from meaningful seeds with unique prefixes.
**When to use:** All program accounts.

**PDA Seed Map:**
```rust
// GlobalConfig -- singleton, one per program
seeds = [b"global_config"]

// BondingCurve -- one per creator token
seeds = [b"bonding_curve", token_mint.key().as_ref()]

// Curve SOL Vault -- holds SOL reserves for a bonding curve
seeds = [b"curve_vault", token_mint.key().as_ref()]

// Curve Token Account -- holds tokens in the bonding curve
seeds = [b"curve_tokens", token_mint.key().as_ref()]

// VestingAccount -- one per creator token
seeds = [b"vesting", token_mint.key().as_ref()]

// Vesting Token Account -- holds creator's vesting tokens
seeds = [b"vesting_tokens", token_mint.key().as_ref()]

// Platform Fee Vault -- global, receives platform's 2.5%
seeds = [b"platform_vault"]

// Creator Fee Vault -- per creator token, receives creator's 2.5%
seeds = [b"creator_vault", token_mint.key().as_ref()]
```

### Pattern 3: Fee Deduction Before Curve Calculation
**What:** Fees are deducted from the input amount before passing to the curve math.
**When to use:** Every buy, sell, and burn instruction.

```rust
// Buy: fee from input SOL
let fee_amount = sol_input * FEE_BPS / 10_000; // 500 bps = 5%
let platform_fee = fee_amount / 2;              // 250 bps = 2.5%
let creator_fee = fee_amount - platform_fee;    // 250 bps = 2.5% (avoid rounding loss)
let sol_into_curve = sol_input - fee_amount;
// Now calculate tokens_out from sol_into_curve

// Sell: fee from output SOL
let gross_sol_out = calculate_sell(token_amount); // curve math
let fee_amount = gross_sol_out * FEE_BPS / 10_000;
let platform_fee = fee_amount / 2;
let creator_fee = fee_amount - platform_fee;
let net_sol_to_seller = gross_sol_out - fee_amount;
```

### Pattern 4: Slippage Protection
**What:** Users specify minimum tokens out (buy) or minimum SOL out (sell). Transaction reverts if actual amount is below the minimum.
**When to use:** buy and sell instructions.

```rust
// Buy instruction parameters
pub fn buy(ctx: Context<Buy>, sol_amount: u64, min_tokens_out: u64) -> Result<()> {
    // ... calculate tokens_out ...
    require!(tokens_out >= min_tokens_out, ErrorCode::SlippageExceeded);
    // ... execute trade ...
}

// Sell instruction parameters
pub fn sell(ctx: Context<Sell>, token_amount: u64, min_sol_out: u64) -> Result<()> {
    // ... calculate sol_out ...
    require!(net_sol_out >= min_sol_out, ErrorCode::SlippageExceeded);
    // ... execute trade ...
}
```

### Anti-Patterns to Avoid
- **Floating-point math:** Never use f32/f64 in on-chain programs. Use u64/u128 integer math with basis points.
- **Division before multiplication:** Always multiply first, then divide, to preserve precision in integer math.
- **Storing bump separately:** Anchor auto-manages canonical bumps. Don't manually store or derive bumps unless needed for CPI signing.
- **Using `anchor_spl::token_interface` when not supporting Token-2022:** Use `anchor_spl::token::Token` types to avoid ambiguity.
- **Checked math on every operation individually:** Prefer chaining checked operations or using the `?` operator pattern with custom errors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token mint/burn/transfer | Raw system program calls | `anchor_spl::token` CPI helpers (mint_to, burn, transfer) | Anchor handles account validation, signer seeds, CPI context |
| PDA derivation and validation | Manual `find_program_address` in instruction | Anchor `seeds` + `bump` constraints | Anchor validates PDA automatically, prevents seed collision bugs |
| Account serialization | Manual borsh serialization | Anchor `#[account]` derive macro | Automatic discriminator, type safety, init/close handling |
| Overflow-safe arithmetic | Manual bit manipulation | `checked_add`, `checked_sub`, `checked_mul`, `checked_div` on u64/u128 | Rust stdlib, zero dependencies, handles all edge cases |
| High-precision fixed-point | Custom fixed-point type | `spl_math::PreciseNumber` | 12 decimal places, battle-tested in SPL programs |
| Test framework | solana-test-validator scripts | `anchor-bankrun` with Jest | 100x faster, time manipulation, account injection |
| Account type checking | Manual discriminator comparison | Anchor `Account<'info, T>` wrapper | Automatic 8-byte discriminator check on deserialization |

**Key insight:** Anchor's constraint system (`seeds`, `has_one`, `constraint`, `Signer`, `Account<>`) handles 80% of security validation declaratively. The remaining 20% is business logic constraints (e.g., vesting cliff check, cooldown enforcement) that must be coded explicitly.

## Common Pitfalls

### Pitfall 1: Integer Overflow in Curve Math
**What goes wrong:** Multiplying two u64 values (e.g., virtual_sol_reserves * virtual_token_reserves) overflows u64 max (18.4 quintillion). With token amounts in the trillions of base units and SOL in billions of lamports, k easily exceeds u64.
**Why it happens:** Solana programs compile in release mode where overflow wraps silently by default.
**How to avoid:** Cast to u128 before multiplication: `let k: u128 = (virtual_sol as u128) * (virtual_token as u128);`. Enable `overflow-checks = true` in Cargo.toml. Use checked arithmetic for all operations.
**Warning signs:** Tests pass with small numbers but fail with realistic token amounts.

### Pitfall 2: Precision Loss in Fee Calculations
**What goes wrong:** Integer division truncates. `5 * 100 / 10000 = 0` instead of 0.05. Small trades can result in zero fees.
**Why it happens:** Dividing before multiplying, or using small intermediate values.
**How to avoid:** Always multiply first: `amount * FEE_BPS / 10_000`. For fee splits, compute one half and subtract from total to avoid rounding loss: `creator_fee = total_fee - platform_fee`.
**Warning signs:** Fee vaults don't accumulate expected amounts in tests.

### Pitfall 3: Missing Mint Authority Revocation Verification
**What goes wrong:** Tokens are created but mint authority is not actually revoked, allowing future minting. Users cannot trust the token.
**Why it happens:** Revocation is a separate CPI call (`set_authority` to None) that can be forgotten or fail silently.
**How to avoid:** Revoke mint authority within the `create_token` instruction atomically -- if revocation fails, the entire transaction reverts. Add a test that verifies mint authority is None after creation.
**Warning signs:** Mint account's `mint_authority` field is not None after token creation.

### Pitfall 4: Vesting Clock Manipulation via `Clock::get()`
**What goes wrong:** Relying on `Clock::get()?.unix_timestamp` for vesting but not accounting for clock drift or stale slots.
**Why it happens:** Solana's clock is approximate, not exact. Validators can be slightly ahead or behind.
**How to avoid:** Use `Clock::get()?.unix_timestamp` (it's the standard approach) but design vesting windows with enough granularity (weekly, not second-precise) that minor clock drift is irrelevant. In tests, use bankrun's time manipulation to advance clock precisely.
**Warning signs:** Vesting claims that should fail near boundaries sometimes succeed (or vice versa).

### Pitfall 5: SOL Vault Drain via Rounding Exploitation
**What goes wrong:** Repeated small sells extract more SOL than should be possible due to rounding in the seller's favor.
**Why it happens:** If rounding always favors the user (ceiling on SOL out), an attacker can profit from many small transactions.
**How to avoid:** Always round in the protocol's favor: floor on SOL output (sell), ceiling on SOL input (buy). This means users always get slightly less than the theoretical amount.
**Warning signs:** SOL vault balance drifts below what the curve state says it should be.

### Pitfall 6: Account Substitution in Fee Withdrawal
**What goes wrong:** An attacker passes their own account as the "platform_vault" or "creator_vault" and drains fees.
**Why it happens:** Missing PDA validation on fee vault accounts.
**How to avoid:** Always derive fee vault addresses via PDA seeds in the account constraint. Anchor's `seeds` constraint handles this automatically.
**Warning signs:** Fee withdrawal succeeds when called by unauthorized accounts in tests.

### Pitfall 7: Forgetting to Reload Accounts After CPI
**What goes wrong:** After a CPI (e.g., token transfer), the program reads stale data from a deserialized account.
**Why it happens:** Anchor does not auto-refresh accounts after CPI calls.
**How to avoid:** Call `.reload()` on any account whose data may have changed after a CPI. Or structure logic so you don't read from accounts after modifying them via CPI.
**Warning signs:** Balance checks after transfers show incorrect values.

### Pitfall 8: 90-Day Cooldown Not Enforced On-Chain
**What goes wrong:** The 90-day launch cooldown is only checked off-chain, allowing direct program calls to bypass it.
**Why it happens:** Requirement SAFE-02 needs on-chain enforcement, not just API-level checks.
**How to avoid:** Store `last_token_launch_timestamp` per creator in a PDA. Check `current_time - last_launch >= 90 days` in the `create_token` instruction. Reject if too soon.
**Warning signs:** A creator can launch two tokens within 90 days via direct program interaction.

## Code Examples

### Creating a Token Mint with PDA Authority (then revoking)
```rust
// Source: Anchor docs (anchor-lang.com/docs/tokens/basics)

#[derive(Accounts)]
pub struct CreateToken<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        mint::decimals = 6,
        mint::authority = bonding_curve,  // PDA is initial mint authority
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        space = 8 + BondingCurve::INIT_SPACE,
        seeds = [b"bonding_curve", token_mint.key().as_ref()],
        bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    // ... other accounts
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
```

### Revoking Mint Authority
```rust
// After minting initial supply, revoke mint authority
let cpi_accounts = SetAuthority {
    account_or_mint: ctx.accounts.token_mint.to_account_info(),
    current_authority: ctx.accounts.bonding_curve.to_account_info(),
};
let seeds = &[b"bonding_curve", ctx.accounts.token_mint.key().as_ref(), &[ctx.bumps.bonding_curve]];
let signer_seeds = &[&seeds[..]];
let cpi_ctx = CpiContext::new_with_signer(
    ctx.accounts.token_program.to_account_info(),
    cpi_accounts,
    signer_seeds,
);
token::set_authority(cpi_ctx, AuthorityType::MintTokens, None)?;
```

### Bonding Curve State Account
```rust
#[account]
#[derive(InitSpace)]
pub struct BondingCurve {
    pub token_mint: Pubkey,                // 32
    pub creator: Pubkey,                   // 32
    pub virtual_token_reserves: u64,       // 8
    pub virtual_sol_reserves: u64,         // 8
    pub real_token_reserves: u64,          // 8
    pub real_sol_reserves: u64,            // 8
    pub token_total_supply: u64,           // 8
    pub fee_bps: u16,                      // 2 (global, copied from GlobalConfig)
    pub burn_sol_price: u64,               // 8 (SOL cost for burn, set by creator)
    pub last_launch_timestamp: i64,        // 8 (for 90-day cooldown)
    pub bump: u8,                          // 1
}
```

### GlobalConfig Account
```rust
#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    pub authority: Pubkey,                 // 32 - platform admin
    pub fee_bps: u16,                      // 2 - total fee in basis points (500 = 5%)
    pub platform_fee_bps: u16,             // 2 - platform share (250 = 2.5%)
    pub creator_fee_bps: u16,              // 2 - creator share (250 = 2.5%)
    pub initial_virtual_token_reserves: u64, // 8
    pub initial_virtual_sol_reserves: u64,   // 8
    pub vesting_cliff_seconds: i64,          // 8 - 30 days = 2_592_000
    pub vesting_duration_seconds: i64,       // 8 - 60 days = 5_184_000
    pub vesting_claim_interval_seconds: i64, // 8 - 7 days = 604_800
    pub launch_cooldown_seconds: i64,        // 8 - 90 days = 7_776_000
    pub creator_allocation_bps: u16,         // 2 - 1000 = 10%
    pub bump: u8,                            // 1
}
```

### VestingAccount
```rust
#[account]
#[derive(InitSpace)]
pub struct VestingAccount {
    pub creator: Pubkey,                   // 32
    pub token_mint: Pubkey,                // 32
    pub total_allocation: u64,             // 8 - total tokens allocated (100M)
    pub claimed_amount: u64,               // 8 - tokens already claimed
    pub start_timestamp: i64,              // 8 - when vesting starts (token creation time)
    pub is_revoked: bool,                  // 1 - true if creator banned
    pub bump: u8,                          // 1
}
```

### Curve Math (Pure Functions)
```rust
// src/math.rs - All math in u128 to prevent overflow

pub fn calculate_buy_tokens(
    virtual_sol_reserves: u64,
    virtual_token_reserves: u64,
    sol_amount: u64,  // after fees
) -> Result<u64> {
    let k: u128 = (virtual_sol_reserves as u128)
        .checked_mul(virtual_token_reserves as u128)
        .ok_or(ErrorCode::MathOverflow)?;

    let new_virtual_sol: u128 = (virtual_sol_reserves as u128)
        .checked_add(sol_amount as u128)
        .ok_or(ErrorCode::MathOverflow)?;

    let new_virtual_token: u128 = k
        .checked_div(new_virtual_sol)
        .ok_or(ErrorCode::MathOverflow)?;

    let tokens_out: u128 = (virtual_token_reserves as u128)
        .checked_sub(new_virtual_token)
        .ok_or(ErrorCode::MathOverflow)?;

    // Floor: round down tokens out (protocol-favorable)
    Ok(tokens_out as u64)
}

pub fn calculate_sell_sol(
    virtual_sol_reserves: u64,
    virtual_token_reserves: u64,
    token_amount: u64,
) -> Result<u64> {
    let k: u128 = (virtual_sol_reserves as u128)
        .checked_mul(virtual_token_reserves as u128)
        .ok_or(ErrorCode::MathOverflow)?;

    let new_virtual_token: u128 = (virtual_token_reserves as u128)
        .checked_add(token_amount as u128)
        .ok_or(ErrorCode::MathOverflow)?;

    let new_virtual_sol: u128 = k
        .checked_div(new_virtual_token)
        .ok_or(ErrorCode::MathOverflow)?;

    let sol_out: u128 = (virtual_sol_reserves as u128)
        .checked_sub(new_virtual_sol)
        .ok_or(ErrorCode::MathOverflow)?;

    // Floor: round down SOL out (protocol-favorable)
    Ok(sol_out as u64)
}

pub fn calculate_fee(amount: u64, fee_bps: u16) -> Result<u64> {
    let fee: u128 = (amount as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(10_000)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(fee as u64)
}
```

### Vesting Claim Calculation
```rust
// Weekly claims after 30-day cliff over 60-day duration
pub fn calculate_claimable(
    vesting: &VestingAccount,
    config: &GlobalConfig,
    current_time: i64,
) -> Result<u64> {
    if vesting.is_revoked {
        return Ok(0);
    }

    let cliff_end = vesting.start_timestamp + config.vesting_cliff_seconds;
    if current_time < cliff_end {
        return Ok(0); // Still in cliff period
    }

    let vest_end = cliff_end + config.vesting_duration_seconds;
    let elapsed_since_cliff = (current_time - cliff_end).min(config.vesting_duration_seconds);

    // Calculate total vested amount based on linear schedule
    let total_vested: u128 = (vesting.total_allocation as u128)
        .checked_mul(elapsed_since_cliff as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(config.vesting_duration_seconds as u128)
        .ok_or(ErrorCode::MathOverflow)?;

    // Snap to weekly claim windows
    let weeks_elapsed = elapsed_since_cliff / config.vesting_claim_interval_seconds;
    let snapped_elapsed = weeks_elapsed * config.vesting_claim_interval_seconds;
    let snapped_vested: u128 = (vesting.total_allocation as u128)
        .checked_mul(snapped_elapsed as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(config.vesting_duration_seconds as u128)
        .ok_or(ErrorCode::MathOverflow)?;

    // Claimable = vested (snapped to weeks) - already claimed
    let claimable = (snapped_vested as u64).saturating_sub(vesting.claimed_amount);
    Ok(claimable)
}
```

### Bankrun Test Setup
```typescript
// Source: anchor-bankrun npm docs + solana.com testing guide

import { BankrunProvider, startAnchor } from "anchor-bankrun";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

// Start test environment with deployed program
const context = await startAnchor(".", [], []);
const provider = new BankrunProvider(context);
const program = new Program(IDL, provider);

// Advance time for vesting tests (bankrun-specific)
const currentClock = await context.banksClient.getClock();
context.setClock({
    ...currentClock,
    unixTimestamp: BigInt(currentClock.unixTimestamp) + BigInt(30 * 24 * 60 * 60), // +30 days
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| solana-test-validator for testing | anchor-bankrun (solana-bankrun) | 2024 | 100x faster tests, time manipulation, account injection |
| Manual account validation | Anchor constraints (#[account]) | Anchor 0.2x+ | Eliminates 80% of security bugs declaratively |
| SPL Token only | SPL Token + Token-2022 available | 2024 | Token-2022 adds extensions; SPL Token still preferred for simple fungible tokens |
| Linear bonding curves | Constant product with virtual reserves | pump.fun 2024 | Proven model for Solana token launches at scale |
| Custom serialization | Anchor InitSpace derive | Anchor 0.30+ | Automatic space calculation for accounts |
| Anchor CLI 0.30.x | Anchor CLI 0.32.1 | Oct 2025 | Latest stable; 1.0.0-rc.2 available but not recommended for production |

**Deprecated/outdated:**
- `anchor-client` (old JS client): Replaced by `@coral-xyz/anchor`
- Manual borsh serialization: Use `#[account]` derive macro
- `solana-test-validator` for unit tests: Use bankrun (keep test-validator for integration/E2E only)

## Open Questions

1. **Exact virtual reserve values for 90/10 distribution**
   - What we know: pump.fun uses 1.073B virtual tokens, 30 SOL virtual reserves for 80/20 distribution (800M to curve, 200M reserved)
   - What's unclear: The exact values that produce the best price curve for a 90/10 split (900M to curve). The initial price and price sensitivity need to be tuned.
   - Recommendation: Start with pump.fun-like parameters scaled for 90/10 (virtual_token_reserves ~1.073B, real_token_reserves ~900M, virtual_sol_reserves ~30 SOL). Tune in testing by simulating realistic buy/sell scenarios and checking that price behavior feels right for creator tokens (should be affordable for viewers spending $1-10 SOL).

2. **Burn-for-access SOL-denominated pricing edge case**
   - What we know: Creator sets a SOL price for burn access. System calculates token equivalent at current curve price.
   - What's unclear: What happens if the curve price changes between the creator setting the price and the viewer burning? Should there be a tolerance window?
   - Recommendation: Calculate the token equivalent at the moment of burn (real-time price). The SOL price is fixed by the creator, and the number of tokens burned varies with the curve price. This is the simplest and fairest approach.

3. **CreatorProfile PDA for 90-day cooldown tracking**
   - What we know: Need to enforce 90-day cooldown between token launches (SAFE-02).
   - What's unclear: Whether to store `last_launch_timestamp` on the BondingCurve account or a separate CreatorProfile PDA.
   - Recommendation: Use a separate `CreatorProfile` PDA (seeds: `[b"creator_profile", creator.key().as_ref()]`) that persists across token launches. The BondingCurve account is per-token and wouldn't track history across multiple launches.

4. **Anchor 0.32.1 vs 1.0.0-rc.2**
   - What we know: 0.32.1 is stable (Oct 2025), 1.0.0-rc.2 is RC (Jan 2026).
   - What's unclear: Whether 1.0.0 will land before this project ships and if migration would be needed.
   - Recommendation: Use 0.32.1 for stability. Migration to 1.0 can happen later if needed.

## Sources

### Primary (HIGH confidence)
- [Anchor Framework official docs](https://www.anchor-lang.com/docs) - Token basics, PDA patterns, account constraints
- [Anchor releases on GitHub](https://github.com/solana-foundation/anchor/releases) - Version 0.32.1 stable, 1.0.0-rc.2 latest
- [Solana official docs - PDAs with Anchor](https://solana.com/docs/programs/anchor/pda) - PDA seed patterns, bump handling
- [Helius - Solana Program Security Guide](https://www.helius.dev/blog/a-hitchhikers-guide-to-solana-program-security) - Security vulnerabilities, prevention patterns
- [Helius - Solana Arithmetic Best Practices](https://www.helius.dev/blog/solana-arithmetic) - Fixed-point math, overflow prevention, basis points
- [pump.fun bonding curve state (rubpy gist)](https://gist.github.com/rubpy/6c57e9d12acd4b6ed84e9f205372631d) - Bonding curve state structure, price formula
- [DeepWiki - Pump.fun Bonding Curve Mechanism](https://deepwiki.com/pump-fun/pump-public-docs/3.1-pump-bonding-curve-mechanism) - Virtual/real reserves, buy/sell formulas
- [docs.rs/pumpfun - BondingCurveAccount](https://docs.rs/pumpfun/latest/pumpfun/accounts/struct.BondingCurveAccount.html) - Rust account structure

### Secondary (MEDIUM confidence)
- [anchor-bankrun npm](https://www.npmjs.com/package/anchor-bankrun) - Bankrun integration for Anchor testing
- [Solana.com - Testing with Jest and Bankrun](https://solana.com/developers/guides/advanced/testing-with-jest-and-bankrun) - Testing patterns
- [QuickNode - Anchor PDA guide](https://www.quicknode.com/guides/solana-development/anchor/how-to-use-program-derived-addresses) - PDA usage patterns
- [QuickNode - Anchor token creation guide](https://www.quicknode.com/guides/solana-development/anchor/create-tokens) - Mint + CPI examples
- [Offside.io - Token-2022 Security](https://blog.offside.io/p/token-2022-security-best-practices-part-1) - Why to prefer SPL Token when Token-2022 not needed
- [Sec3 Blog - Overflow/Underflow](https://www.sec3.dev/blog/understanding-arithmetic-overflow-underflows-in-rust-and-solana-smart-contracts) - Checked arithmetic patterns

### Tertiary (LOW confidence)
- [m4rcu5o/Solana-pumpfun-smart-contract](https://github.com/m4rcu5o/Solana-pumpfun-smart-contract) - Pump.fun clone reference (community, not audited)
- [rally-dfs/token-bonding-curve](https://github.com/rally-dfs/token-bonding-curve) - Linear curve reference implementation
- [Medium - Math behind Pump.fun](https://medium.com/@buildwithbhavya/the-math-behind-pump-fun-b58fdb30ed77) - Curve analysis (community post)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Anchor 0.32.1 is well-documented, versions verified via GitHub releases and docs.rs
- Architecture: HIGH - Constant product curve pattern verified across pump.fun docs, multiple implementations, and official Solana resources
- Pitfalls: HIGH - Security patterns verified via Helius security guide, Sec3 blog, and Solana official docs
- Curve math: MEDIUM - Formula is well-established (constant product) but exact initial parameters for 90/10 split need tuning in testing
- Vesting math: MEDIUM - Logic is straightforward but weekly claim snapping needs careful testing at boundaries

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (Anchor ecosystem is stable; 1.0 release may land but won't break 0.32.1 programs)
