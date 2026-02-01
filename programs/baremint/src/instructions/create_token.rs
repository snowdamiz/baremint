use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, SetAuthority, Token, TokenAccount, Transfer};

use crate::errors::ErrorCode;
use crate::state::{BondingCurve, CreatorProfile, GlobalConfig, VestingAccount};

#[derive(Accounts)]
pub struct CreateToken<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        seeds = [b"global_config"],
        bump = global_config.bump,
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        init_if_needed,
        payer = creator,
        seeds = [b"creator_profile", creator.key().as_ref()],
        bump,
        space = 8 + CreatorProfile::INIT_SPACE,
    )]
    pub creator_profile: Account<'info, CreatorProfile>,

    #[account(
        init,
        payer = creator,
        mint::decimals = 6,
        mint::authority = bonding_curve,
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        seeds = [b"bonding_curve", token_mint.key().as_ref()],
        bump,
        space = 8 + BondingCurve::INIT_SPACE,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(
        init,
        payer = creator,
        token::mint = token_mint,
        token::authority = bonding_curve,
        seeds = [b"curve_tokens", token_mint.key().as_ref()],
        bump,
    )]
    pub curve_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = creator,
        seeds = [b"vesting", token_mint.key().as_ref()],
        bump,
        space = 8 + VestingAccount::INIT_SPACE,
    )]
    pub vesting_account: Account<'info, VestingAccount>,

    #[account(
        init,
        payer = creator,
        token::mint = token_mint,
        token::authority = vesting_account,
        seeds = [b"vesting_tokens", token_mint.key().as_ref()],
        bump,
    )]
    pub vesting_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<CreateToken>, burn_sol_price: u64) -> Result<()> {
    let clock = Clock::get()?;
    let config = &ctx.accounts.global_config;
    let creator_profile = &ctx.accounts.creator_profile;

    // Check 90-day cooldown
    if creator_profile.last_token_launch_timestamp > 0 {
        let elapsed = clock
            .unix_timestamp
            .checked_sub(creator_profile.last_token_launch_timestamp)
            .ok_or(ErrorCode::MathOverflow)?;
        require!(
            elapsed >= config.launch_cooldown_seconds,
            ErrorCode::CooldownNotElapsed
        );
    }

    // Calculate supply distribution
    let total_supply: u64 = 1_000_000_000_000_000; // 1B with 6 decimals
    let creator_allocation_bps = config.creator_allocation_bps as u64;
    let vesting_amount = total_supply
        .checked_mul(creator_allocation_bps)
        .ok_or(ErrorCode::MathOverflow)?
        / 10_000;
    let curve_amount = total_supply
        .checked_sub(vesting_amount)
        .ok_or(ErrorCode::MathOverflow)?;

    // Bonding curve PDA signer seeds
    let token_mint_key = ctx.accounts.token_mint.key();
    let bump = ctx.bumps.bonding_curve;
    let signer_seeds: &[&[&[u8]]] = &[&[b"bonding_curve", token_mint_key.as_ref(), &[bump]]];

    // Mint total supply to curve_token_account
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.curve_token_account.to_account_info(),
                authority: ctx.accounts.bonding_curve.to_account_info(),
            },
            signer_seeds,
        ),
        total_supply,
    )?;

    // Transfer vesting_amount from curve_token_account to vesting_token_account
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.curve_token_account.to_account_info(),
                to: ctx.accounts.vesting_token_account.to_account_info(),
                authority: ctx.accounts.bonding_curve.to_account_info(),
            },
            signer_seeds,
        ),
        vesting_amount,
    )?;

    // Revoke mint authority -- makes token supply permanently fixed
    token::set_authority(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            SetAuthority {
                current_authority: ctx.accounts.bonding_curve.to_account_info(),
                account_or_mint: ctx.accounts.token_mint.to_account_info(),
            },
            signer_seeds,
        ),
        anchor_spl::token::spl_token::instruction::AuthorityType::MintTokens,
        None,
    )?;

    // Initialize BondingCurve state
    let bonding_curve = &mut ctx.accounts.bonding_curve;
    bonding_curve.token_mint = ctx.accounts.token_mint.key();
    bonding_curve.creator = ctx.accounts.creator.key();
    bonding_curve.virtual_token_reserves = config.initial_virtual_token_reserves;
    bonding_curve.virtual_sol_reserves = config.initial_virtual_sol_reserves;
    bonding_curve.real_token_reserves = curve_amount;
    bonding_curve.real_sol_reserves = 0;
    bonding_curve.token_total_supply = total_supply;
    bonding_curve.burn_sol_price = burn_sol_price;
    bonding_curve.platform_fees_accrued = 0;
    bonding_curve.creator_fees_accrued = 0;
    bonding_curve.bump = bump;

    // Initialize VestingAccount
    let vesting = &mut ctx.accounts.vesting_account;
    vesting.creator = ctx.accounts.creator.key();
    vesting.token_mint = ctx.accounts.token_mint.key();
    vesting.total_allocation = vesting_amount;
    vesting.claimed_amount = 0;
    vesting.start_timestamp = clock.unix_timestamp;
    vesting.is_revoked = false;
    vesting.bump = ctx.bumps.vesting_account;

    // Update CreatorProfile
    let profile = &mut ctx.accounts.creator_profile;
    profile.creator = ctx.accounts.creator.key();
    profile.last_token_launch_timestamp = clock.unix_timestamp;
    profile.tokens_launched = profile
        .tokens_launched
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    profile.bump = ctx.bumps.creator_profile;

    Ok(())
}
