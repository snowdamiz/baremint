use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::ErrorCode;
use crate::math;
use crate::state::{BondingCurve, GlobalConfig};

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

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

    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"curve_tokens", token_mint.key().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = bonding_curve,
    )]
    pub curve_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Buy>, sol_amount: u64, min_tokens_out: u64) -> Result<()> {
    let config = &ctx.accounts.global_config;
    let bonding_curve = &ctx.accounts.bonding_curve;

    // Calculate fees
    let total_fee = math::calculate_fee(sol_amount, config.fee_bps)?;
    let platform_fee = total_fee / 2;
    let creator_fee = total_fee
        .checked_sub(platform_fee)
        .ok_or(ErrorCode::MathOverflow)?;

    // SOL going into curve (after fee deduction)
    let sol_into_curve = sol_amount
        .checked_sub(total_fee)
        .ok_or(ErrorCode::MathOverflow)?;

    // Calculate tokens out from constant product curve
    let tokens_out = math::calculate_buy_tokens(
        bonding_curve.virtual_sol_reserves,
        bonding_curve.virtual_token_reserves,
        sol_into_curve,
    )?;

    // Slippage check
    require!(tokens_out >= min_tokens_out, ErrorCode::SlippageExceeded);

    // Check sufficient real token reserves
    require!(
        bonding_curve.real_token_reserves >= tokens_out,
        ErrorCode::InsufficientReserves
    );

    // Transfer ALL sol_amount from buyer to bonding_curve PDA
    // (reserves + fees all held in the same PDA)
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.bonding_curve.to_account_info(),
            },
        ),
        sol_amount,
    )?;

    // Transfer tokens from curve to buyer
    let token_mint_key = ctx.accounts.token_mint.key();
    let bump = bonding_curve.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[b"bonding_curve", token_mint_key.as_ref(), &[bump]]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.curve_token_account.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: ctx.accounts.bonding_curve.to_account_info(),
            },
            signer_seeds,
        ),
        tokens_out,
    )?;

    // Update bonding curve state
    let bonding_curve = &mut ctx.accounts.bonding_curve;
    bonding_curve.virtual_sol_reserves = bonding_curve
        .virtual_sol_reserves
        .checked_add(sol_into_curve)
        .ok_or(ErrorCode::MathOverflow)?;
    bonding_curve.virtual_token_reserves = bonding_curve
        .virtual_token_reserves
        .checked_sub(tokens_out)
        .ok_or(ErrorCode::MathOverflow)?;
    bonding_curve.real_sol_reserves = bonding_curve
        .real_sol_reserves
        .checked_add(sol_into_curve)
        .ok_or(ErrorCode::MathOverflow)?;
    bonding_curve.real_token_reserves = bonding_curve
        .real_token_reserves
        .checked_sub(tokens_out)
        .ok_or(ErrorCode::MathOverflow)?;
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
