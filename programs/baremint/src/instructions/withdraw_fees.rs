use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::errors::ErrorCode;
use crate::state::{BondingCurve, GlobalConfig};

// --- Withdraw Platform Fees ---

#[derive(Accounts)]
pub struct WithdrawPlatformFees<'info> {
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
        seeds = [b"bonding_curve", token_mint.key().as_ref()],
        bump = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    pub token_mint: Account<'info, Mint>,
}

pub fn handler_withdraw_platform_fees(ctx: Context<WithdrawPlatformFees>) -> Result<()> {
    let amount = ctx.accounts.bonding_curve.platform_fees_accrued;

    if amount == 0 {
        return Ok(());
    }

    // Transfer lamports from bonding_curve PDA to authority
    let bonding_curve_info = ctx.accounts.bonding_curve.to_account_info();
    let authority_info = ctx.accounts.authority.to_account_info();

    // Ensure bonding_curve retains enough lamports for rent exemption
    let rent = Rent::get()?;
    let min_lamports = rent.minimum_balance(bonding_curve_info.data_len());
    let current_lamports = bonding_curve_info.lamports();
    require!(
        current_lamports
            .checked_sub(amount)
            .ok_or(ErrorCode::MathOverflow)?
            >= min_lamports,
        ErrorCode::InsufficientReserves
    );

    **bonding_curve_info.try_borrow_mut_lamports()? -= amount;
    **authority_info.try_borrow_mut_lamports()? += amount;

    // Reset accrued fees
    ctx.accounts.bonding_curve.platform_fees_accrued = 0;

    Ok(())
}

// --- Withdraw Creator Fees ---

#[derive(Accounts)]
pub struct WithdrawCreatorFees<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bonding_curve", token_mint.key().as_ref()],
        bump = bonding_curve.bump,
        constraint = creator.key() == bonding_curve.creator @ ErrorCode::Unauthorized,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    pub token_mint: Account<'info, Mint>,
}

pub fn handler_withdraw_creator_fees(ctx: Context<WithdrawCreatorFees>) -> Result<()> {
    let amount = ctx.accounts.bonding_curve.creator_fees_accrued;

    if amount == 0 {
        return Ok(());
    }

    // Transfer lamports from bonding_curve PDA to creator
    let bonding_curve_info = ctx.accounts.bonding_curve.to_account_info();
    let creator_info = ctx.accounts.creator.to_account_info();

    // Ensure bonding_curve retains enough lamports for rent exemption
    let rent = Rent::get()?;
    let min_lamports = rent.minimum_balance(bonding_curve_info.data_len());
    let current_lamports = bonding_curve_info.lamports();
    require!(
        current_lamports
            .checked_sub(amount)
            .ok_or(ErrorCode::MathOverflow)?
            >= min_lamports,
        ErrorCode::InsufficientReserves
    );

    **bonding_curve_info.try_borrow_mut_lamports()? -= amount;
    **creator_info.try_borrow_mut_lamports()? += amount;

    // Reset accrued fees
    ctx.accounts.bonding_curve.creator_fees_accrued = 0;

    Ok(())
}
