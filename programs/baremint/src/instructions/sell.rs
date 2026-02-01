use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::ErrorCode;
use crate::math;
use crate::state::{BondingCurve, GlobalConfig};

#[derive(Accounts)]
pub struct Sell<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

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
        token::authority = seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Sell>, token_amount: u64, min_sol_out: u64) -> Result<()> {
    let config = &ctx.accounts.global_config;
    let bonding_curve = &ctx.accounts.bonding_curve;

    // Calculate gross SOL output from constant product curve
    let gross_sol_out = math::calculate_sell_sol(
        bonding_curve.virtual_sol_reserves,
        bonding_curve.virtual_token_reserves,
        token_amount,
    )?;

    // Calculate fees on the gross output
    let total_fee = math::calculate_fee(gross_sol_out, config.fee_bps)?;
    let platform_fee = total_fee / 2;
    let creator_fee = total_fee
        .checked_sub(platform_fee)
        .ok_or(ErrorCode::MathOverflow)?;

    // Net SOL to send to seller
    let net_sol_out = gross_sol_out
        .checked_sub(total_fee)
        .ok_or(ErrorCode::MathOverflow)?;

    // Slippage check
    require!(net_sol_out >= min_sol_out, ErrorCode::SlippageExceeded);

    // Check sufficient real SOL reserves for gross amount
    require!(
        bonding_curve.real_sol_reserves >= gross_sol_out,
        ErrorCode::InsufficientReserves
    );

    // Transfer tokens from seller to curve
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.seller_token_account.to_account_info(),
                to: ctx.accounts.curve_token_account.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        token_amount,
    )?;

    // Transfer net_sol_out from bonding_curve PDA to seller via lamport manipulation.
    // The program owns the bonding_curve PDA so we can directly modify lamports.
    let bonding_curve_info = ctx.accounts.bonding_curve.to_account_info();
    let seller_info = ctx.accounts.seller.to_account_info();

    // Ensure bonding_curve retains enough lamports for rent exemption
    let rent = Rent::get()?;
    let min_lamports = rent.minimum_balance(bonding_curve_info.data_len());
    let current_lamports = bonding_curve_info.lamports();
    require!(
        current_lamports
            .checked_sub(net_sol_out)
            .ok_or(ErrorCode::MathOverflow)?
            >= min_lamports,
        ErrorCode::InsufficientReserves
    );

    **bonding_curve_info.try_borrow_mut_lamports()? -= net_sol_out;
    **seller_info.try_borrow_mut_lamports()? += net_sol_out;

    // Update bonding curve state
    let bonding_curve = &mut ctx.accounts.bonding_curve;
    bonding_curve.virtual_sol_reserves = bonding_curve
        .virtual_sol_reserves
        .checked_sub(gross_sol_out)
        .ok_or(ErrorCode::MathOverflow)?;
    bonding_curve.virtual_token_reserves = bonding_curve
        .virtual_token_reserves
        .checked_add(token_amount)
        .ok_or(ErrorCode::MathOverflow)?;
    bonding_curve.real_sol_reserves = bonding_curve
        .real_sol_reserves
        .checked_sub(gross_sol_out)
        .ok_or(ErrorCode::MathOverflow)?;
    bonding_curve.real_token_reserves = bonding_curve
        .real_token_reserves
        .checked_add(token_amount)
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
