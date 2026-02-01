use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::errors::ErrorCode;
use crate::state::{BondingCurve, GlobalConfig, VestingAccount};

#[derive(Accounts)]
pub struct RevokeVesting<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"global_config"],
        bump = global_config.bump,
        constraint = authority.key() == global_config.authority @ ErrorCode::Unauthorized,
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"vesting", token_mint.key().as_ref()],
        bump = vesting_account.bump,
    )]
    pub vesting_account: Account<'info, VestingAccount>,

    #[account(mut)]
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
        seeds = [b"bonding_curve", token_mint.key().as_ref()],
        bump = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<RevokeVesting>) -> Result<()> {
    let vesting = &ctx.accounts.vesting_account;

    // Idempotent: if already revoked, just return Ok
    if vesting.is_revoked {
        return Ok(());
    }

    // Calculate unvested amount
    let unvested = vesting
        .total_allocation
        .checked_sub(vesting.claimed_amount)
        .ok_or(ErrorCode::MathOverflow)?;

    // Burn unvested tokens from vesting_token_account
    // vesting_account PDA is the authority of the vesting_token_account
    if unvested > 0 {
        let token_mint_key = ctx.accounts.token_mint.key();
        let bump = vesting.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"vesting", token_mint_key.as_ref(), &[bump]]];

        token::burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    from: ctx.accounts.vesting_token_account.to_account_info(),
                    authority: ctx.accounts.vesting_account.to_account_info(),
                },
                signer_seeds,
            ),
            unvested,
        )?;

        // Track deflation in bonding_curve (informational -- vesting tokens were never in curve)
        let bonding_curve = &mut ctx.accounts.bonding_curve;
        bonding_curve.token_total_supply = bonding_curve
            .token_total_supply
            .checked_sub(unvested)
            .ok_or(ErrorCode::MathOverflow)?;
    }

    // Mark vesting as revoked
    let vesting = &mut ctx.accounts.vesting_account;
    vesting.is_revoked = true;

    Ok(())
}
