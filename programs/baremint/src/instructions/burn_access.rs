use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::errors::ErrorCode;
use crate::math;
use crate::state::{BondingCurve, GlobalConfig};

#[derive(Accounts)]
pub struct BurnAccess<'info> {
    #[account(mut)]
    pub viewer: Signer<'info>,

    #[account(
        seeds = [b"global_config"],
        bump = global_config.bump,
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"bonding_curve", token_mint.key().as_ref()],
        bump = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(mut)]
    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = viewer,
    )]
    pub viewer_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<BurnAccess>) -> Result<()> {
    let config = &ctx.accounts.global_config;
    let bonding_curve = &ctx.accounts.bonding_curve;

    // Burn must be enabled (burn_sol_price > 0)
    require!(bonding_curve.burn_sol_price > 0, ErrorCode::BurnDisabled);

    // Calculate how many tokens to burn based on SOL-denominated price
    let tokens_to_burn = math::calculate_tokens_for_sol_value(
        bonding_curve.virtual_sol_reserves,
        bonding_curve.virtual_token_reserves,
        bonding_curve.burn_sol_price,
    )?;

    // Check viewer has enough tokens
    require!(
        ctx.accounts.viewer_token_account.amount >= tokens_to_burn,
        ErrorCode::InsufficientTokens
    );

    // Calculate fees from the SOL equivalent (burn_sol_price IS the SOL value)
    let sol_equivalent = bonding_curve.burn_sol_price;
    let total_fee = math::calculate_fee(sol_equivalent, config.fee_bps)?;
    let platform_fee = total_fee / 2;
    let creator_fee = total_fee
        .checked_sub(platform_fee)
        .ok_or(ErrorCode::MathOverflow)?;

    // Burn tokens from viewer's account (viewer signs)
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.token_mint.to_account_info(),
                from: ctx.accounts.viewer_token_account.to_account_info(),
                authority: ctx.accounts.viewer.to_account_info(),
            },
        ),
        tokens_to_burn,
    )?;

    // DEFLATIONARY: No SOL returned to viewer. Tokens destroyed.
    // Fees extracted from bonding_curve PDA reserves into accrual fields.

    // Update bonding curve state
    let bonding_curve = &mut ctx.accounts.bonding_curve;

    // Fewer real tokens exist (burned)
    bonding_curve.real_token_reserves = bonding_curve
        .real_token_reserves
        .checked_sub(tokens_to_burn)
        .ok_or(ErrorCode::MathOverflow)?;

    // Fees extracted from reserves
    bonding_curve.real_sol_reserves = bonding_curve
        .real_sol_reserves
        .checked_sub(total_fee)
        .ok_or(ErrorCode::MathOverflow)?;

    // Fees reduce SOL in the curve pricing model
    bonding_curve.virtual_sol_reserves = bonding_curve
        .virtual_sol_reserves
        .checked_sub(total_fee)
        .ok_or(ErrorCode::MathOverflow)?;

    // virtual_token_reserves stays UNCHANGED:
    // Tokens are burned, NOT returned to curve. Price goes UP for remaining holders.

    // Track total supply decrease
    bonding_curve.token_total_supply = bonding_curve
        .token_total_supply
        .checked_sub(tokens_to_burn)
        .ok_or(ErrorCode::MathOverflow)?;

    // Accrue fees
    bonding_curve.platform_fees_accrued = bonding_curve
        .platform_fees_accrued
        .checked_add(platform_fee)
        .ok_or(ErrorCode::MathOverflow)?;
    bonding_curve.creator_fees_accrued = bonding_curve
        .creator_fees_accrued
        .checked_add(creator_fee)
        .ok_or(ErrorCode::MathOverflow)?;

    Ok(())
}
