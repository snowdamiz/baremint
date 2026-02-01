use anchor_lang::prelude::*;

use crate::errors::ErrorCode;

/// Calculate tokens received for a given SOL input using constant product formula.
/// k = virtual_sol * virtual_token (invariant)
/// Rounds DOWN (protocol-favorable: buyer gets fewer tokens).
pub fn calculate_buy_tokens(
    virtual_sol_reserves: u64,
    virtual_token_reserves: u64,
    sol_amount: u64,
) -> Result<u64> {
    if sol_amount == 0 {
        return Ok(0);
    }

    let virtual_sol = virtual_sol_reserves as u128;
    let virtual_token = virtual_token_reserves as u128;
    let sol_in = sol_amount as u128;

    let k = virtual_sol
        .checked_mul(virtual_token)
        .ok_or(ErrorCode::MathOverflow)?;

    let new_virtual_sol = virtual_sol
        .checked_add(sol_in)
        .ok_or(ErrorCode::MathOverflow)?;

    let new_virtual_token = k
        .checked_div(new_virtual_sol)
        .ok_or(ErrorCode::MathOverflow)?;

    let tokens_out = virtual_token
        .checked_sub(new_virtual_token)
        .ok_or(ErrorCode::MathOverflow)?;

    // Floor: truncation from integer division is already floor
    Ok(tokens_out as u64)
}

/// Calculate SOL received for selling tokens using constant product formula.
/// Rounds DOWN (protocol-favorable: seller gets less SOL).
pub fn calculate_sell_sol(
    virtual_sol_reserves: u64,
    virtual_token_reserves: u64,
    token_amount: u64,
) -> Result<u64> {
    if token_amount == 0 {
        return Ok(0);
    }

    let virtual_sol = virtual_sol_reserves as u128;
    let virtual_token = virtual_token_reserves as u128;
    let tokens_in = token_amount as u128;

    let k = virtual_sol
        .checked_mul(virtual_token)
        .ok_or(ErrorCode::MathOverflow)?;

    let new_virtual_token = virtual_token
        .checked_add(tokens_in)
        .ok_or(ErrorCode::MathOverflow)?;

    let new_virtual_sol = k
        .checked_div(new_virtual_token)
        .ok_or(ErrorCode::MathOverflow)?;

    let sol_out = virtual_sol
        .checked_sub(new_virtual_sol)
        .ok_or(ErrorCode::MathOverflow)?;

    // Floor: truncation from integer division is already floor
    Ok(sol_out as u64)
}

/// Calculate fee amount. Rounds UP (protocol-favorable: more fees collected).
/// fee = ceil(amount * fee_bps / 10_000)
pub fn calculate_fee(amount: u64, fee_bps: u16) -> Result<u64> {
    if amount == 0 || fee_bps == 0 {
        return Ok(0);
    }

    let amount = amount as u128;
    let bps = fee_bps as u128;

    // Ceiling division: (amount * bps + 9999) / 10000
    let numerator = amount
        .checked_mul(bps)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_add(9999)
        .ok_or(ErrorCode::MathOverflow)?;

    let fee = numerator / 10_000;

    Ok(fee as u64)
}

/// Calculate how many tokens a given SOL value is worth at current reserves.
/// Used for burn-for-access pricing.
/// Rounds UP (protocol-favorable: more tokens burned).
/// tokens = ceil(sol_value * virtual_token_reserves / virtual_sol_reserves)
pub fn calculate_tokens_for_sol_value(
    virtual_sol_reserves: u64,
    virtual_token_reserves: u64,
    sol_value: u64,
) -> Result<u64> {
    if sol_value == 0 {
        return Ok(0);
    }

    let sol_val = sol_value as u128;
    let v_token = virtual_token_reserves as u128;
    let v_sol = virtual_sol_reserves as u128;

    // Ceiling division: (sol_value * virtual_token + virtual_sol - 1) / virtual_sol
    let numerator = sol_val
        .checked_mul(v_token)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_add(v_sol.checked_sub(1).ok_or(ErrorCode::MathOverflow)?)
        .ok_or(ErrorCode::MathOverflow)?;

    let tokens = numerator
        .checked_div(v_sol)
        .ok_or(ErrorCode::MathOverflow)?;

    Ok(tokens as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Default reserves from pump.fun-style curve:
    // 1,073,000,000 tokens (with 6 decimals = 1_073_000_000_000_000)
    // 30 SOL (with 9 decimals = 30_000_000_000)
    const VIRTUAL_TOKEN_RESERVES: u64 = 1_073_000_000_000_000;
    const VIRTUAL_SOL_RESERVES: u64 = 30_000_000_000;

    #[test]
    fn test_buy_tokens_basic() {
        // Buy with 1 SOL
        let sol_amount = 1_000_000_000; // 1 SOL
        let tokens = calculate_buy_tokens(
            VIRTUAL_SOL_RESERVES,
            VIRTUAL_TOKEN_RESERVES,
            sol_amount,
        )
        .unwrap();

        // With constant product: tokens_out = 1073M * 1 / (30 + 1) ~= 34.6M tokens
        // In lamports: ~34_612_903_225_806
        assert!(tokens > 0);
        assert!(tokens < VIRTUAL_TOKEN_RESERVES); // Can't get more than reserves

        // Approximate check: ~34.6M tokens (with 6 decimals)
        let tokens_in_whole = tokens / 1_000_000;
        assert!(
            tokens_in_whole > 34_000_000 && tokens_in_whole < 35_000_000,
            "Expected ~34.6M tokens, got {}",
            tokens_in_whole
        );
    }

    #[test]
    fn test_sell_sol_basic() {
        // Sell 34M tokens
        let token_amount = 34_000_000_000_000; // 34M tokens with 6 decimals
        let sol = calculate_sell_sol(
            VIRTUAL_SOL_RESERVES,
            VIRTUAL_TOKEN_RESERVES,
            token_amount,
        )
        .unwrap();

        assert!(sol > 0);
        assert!(sol < VIRTUAL_SOL_RESERVES);

        // Should get roughly ~0.92 SOL for 34M tokens
        let sol_in_lamports = sol;
        assert!(
            sol_in_lamports > 500_000_000 && sol_in_lamports < 1_500_000_000,
            "Expected ~0.92 SOL, got {} lamports",
            sol_in_lamports
        );
    }

    #[test]
    fn test_buy_sell_round_trip() {
        // Buy tokens, then sell the same tokens back.
        // Due to integer floor division, the round-trip may have tiny rounding variance
        // (at most 1 lamport). In production, fees ensure the protocol always profits.
        let sol_in = 1_000_000_000; // 1 SOL
        let tokens = calculate_buy_tokens(
            VIRTUAL_SOL_RESERVES,
            VIRTUAL_TOKEN_RESERVES,
            sol_in,
        )
        .unwrap();

        // After buy, reserves shift
        let new_sol_reserves = VIRTUAL_SOL_RESERVES + sol_in;
        let new_token_reserves = VIRTUAL_TOKEN_RESERVES - tokens;

        let sol_out = calculate_sell_sol(new_sol_reserves, new_token_reserves, tokens).unwrap();

        // Round-trip should be very close to the input (within 1-2 lamports of rounding)
        let diff = if sol_out > sol_in {
            sol_out - sol_in
        } else {
            sol_in - sol_out
        };
        assert!(
            diff <= 1,
            "Round-trip should be within 1 lamport. Input: {}, output: {}, diff: {}",
            sol_in,
            sol_out,
            diff
        );
    }

    #[test]
    fn test_fee_calculation() {
        // 5% fee on 1 SOL
        let fee = calculate_fee(1_000_000_000, 500).unwrap();
        // 1_000_000_000 * 500 / 10_000 = 50_000_000
        assert_eq!(fee, 50_000_000);

        // Fee rounds up: 1 lamport * 500 bps
        let fee_small = calculate_fee(1, 500).unwrap();
        // ceil(1 * 500 / 10000) = ceil(0.05) = 1
        assert_eq!(fee_small, 1);

        // 2.5% fee (250 bps)
        let fee_half = calculate_fee(1_000_000_000, 250).unwrap();
        assert_eq!(fee_half, 25_000_000);
    }

    #[test]
    fn test_fee_zero_inputs() {
        assert_eq!(calculate_fee(0, 500).unwrap(), 0);
        assert_eq!(calculate_fee(1_000_000_000, 0).unwrap(), 0);
        assert_eq!(calculate_fee(0, 0).unwrap(), 0);
    }

    #[test]
    fn test_buy_zero_amount() {
        let tokens = calculate_buy_tokens(VIRTUAL_SOL_RESERVES, VIRTUAL_TOKEN_RESERVES, 0).unwrap();
        assert_eq!(tokens, 0);
    }

    #[test]
    fn test_sell_zero_amount() {
        let sol = calculate_sell_sol(VIRTUAL_SOL_RESERVES, VIRTUAL_TOKEN_RESERVES, 0).unwrap();
        assert_eq!(sol, 0);
    }

    #[test]
    fn test_tokens_for_sol_value() {
        // At default reserves: price = 30 SOL / 1073M tokens
        // 1 SOL worth of tokens = 1073M / 30 ~= 35.77M
        let tokens =
            calculate_tokens_for_sol_value(VIRTUAL_SOL_RESERVES, VIRTUAL_TOKEN_RESERVES, 1_000_000_000)
                .unwrap();

        let tokens_whole = tokens / 1_000_000;
        assert!(
            tokens_whole > 35_000_000 && tokens_whole < 36_000_000,
            "Expected ~35.77M tokens, got {}",
            tokens_whole
        );
    }

    #[test]
    fn test_tokens_for_sol_value_rounds_up() {
        // Use values that don't divide evenly to verify ceiling
        let tokens = calculate_tokens_for_sol_value(3, 10, 1).unwrap();
        // ceil(1 * 10 / 3) = ceil(3.33) = 4
        assert_eq!(tokens, 4);
    }

    #[test]
    fn test_overflow_protection_buy() {
        // Large values that could overflow without u128
        let result = calculate_buy_tokens(u64::MAX, u64::MAX, u64::MAX);
        // This should either succeed or return MathOverflow, not panic
        assert!(result.is_ok() || result.is_err());
    }

    #[test]
    fn test_overflow_protection_sell() {
        let result = calculate_sell_sol(u64::MAX, u64::MAX, u64::MAX);
        assert!(result.is_ok() || result.is_err());
    }

    #[test]
    fn test_overflow_protection_fee() {
        // u64::MAX * 10000 would overflow even u128? No, u128 handles it.
        let fee = calculate_fee(u64::MAX, 10000).unwrap();
        // 100% fee = amount itself (with ceiling)
        assert_eq!(fee, u64::MAX);
    }

    #[test]
    fn test_large_buy() {
        // Buy with 10 SOL
        let tokens = calculate_buy_tokens(
            VIRTUAL_SOL_RESERVES,
            VIRTUAL_TOKEN_RESERVES,
            10_000_000_000,
        )
        .unwrap();

        // 10 SOL into 30 SOL reserves: tokens = 1073M * 10 / 40 = 268.25M
        let tokens_whole = tokens / 1_000_000;
        assert!(
            tokens_whole > 267_000_000 && tokens_whole < 269_000_000,
            "Expected ~268.25M tokens, got {}",
            tokens_whole
        );
    }
}
