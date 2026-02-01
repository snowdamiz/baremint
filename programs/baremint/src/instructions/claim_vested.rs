use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::ErrorCode;
use crate::state::{GlobalConfig, VestingAccount};

#[derive(Accounts)]
pub struct ClaimVested<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        seeds = [b"global_config"],
        bump = global_config.bump,
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"vesting", token_mint.key().as_ref()],
        bump = vesting_account.bump,
        constraint = creator.key() == vesting_account.creator @ ErrorCode::Unauthorized,
    )]
    pub vesting_account: Account<'info, VestingAccount>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"vesting_tokens", token_mint.key().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = vesting_account,
    )]
    pub vesting_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = creator,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClaimVested>) -> Result<()> {
    let config = &ctx.accounts.global_config;
    let vesting = &ctx.accounts.vesting_account;

    // Check vesting has not been revoked
    require!(!vesting.is_revoked, ErrorCode::VestingRevoked);

    // Get current time
    let current_time = Clock::get()?.unix_timestamp;

    // Check cliff has been reached
    let cliff_end = vesting
        .start_timestamp
        .checked_add(config.vesting_cliff_seconds)
        .ok_or(ErrorCode::MathOverflow)?;
    require!(current_time >= cliff_end, ErrorCode::VestingCliffNotReached);

    // Calculate claimable amount with weekly windows
    let elapsed_since_cliff = std::cmp::min(
        current_time
            .checked_sub(cliff_end)
            .ok_or(ErrorCode::MathOverflow)?,
        config.vesting_duration_seconds,
    );

    // Snap to weekly windows
    let weeks_elapsed = elapsed_since_cliff / config.vesting_claim_interval_seconds;
    let snapped_elapsed = weeks_elapsed
        .checked_mul(config.vesting_claim_interval_seconds)
        .ok_or(ErrorCode::MathOverflow)?;

    // Linear vesting: total_vested = total_allocation * snapped_elapsed / vesting_duration_seconds
    let total_vested = (vesting.total_allocation as u128)
        .checked_mul(snapped_elapsed as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(config.vesting_duration_seconds as u128)
        .ok_or(ErrorCode::MathOverflow)? as u64;

    let claimable = total_vested
        .checked_sub(vesting.claimed_amount)
        .ok_or(ErrorCode::MathOverflow)?;

    require!(claimable > 0, ErrorCode::VestingFullyClaimed);

    // Transfer claimable tokens from vesting_token_account to creator_token_account
    let token_mint_key = ctx.accounts.token_mint.key();
    let bump = vesting.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[b"vesting", token_mint_key.as_ref(), &[bump]]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vesting_token_account.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: ctx.accounts.vesting_account.to_account_info(),
            },
            signer_seeds,
        ),
        claimable,
    )?;

    // Update claimed amount
    let vesting = &mut ctx.accounts.vesting_account;
    vesting.claimed_amount = vesting
        .claimed_amount
        .checked_add(claimable)
        .ok_or(ErrorCode::MathOverflow)?;

    Ok(())
}
